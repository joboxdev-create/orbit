import type {
  Capability,
  ConnectorDefinition,
  ToolCall,
} from "@orbit/connector-sdk";
import { z } from "zod";
import {
  anthropicFetchStream,
  anthropicGet,
  anthropicPost,
  anthropicRawRequest,
  readLines,
  type AnthropicConfig,
  type AnthropicCredentials,
} from "./client.js";

const configSchema = z.object({
  baseUrl: z.string().url().default("https://api.anthropic.com"),
});

const credentialsSchema = z.object({
  apiKey: z.string().min(1),
});

// --- raw API shapes (only the fields we surface) ---
interface AnthropicBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface AnthropicMessage {
  model: string;
  content?: AnthropicBlock[];
  stop_reason?: string;
}

interface AnthropicModels {
  data: { id: string; display_name?: string }[];
}

/** Map Orbit's unified messages to the Anthropic Messages format (tool blocks). */
function toAnthropicMessages(
  messages: { role: string; content: string; toolCalls?: unknown; toolCallId?: string }[],
): unknown[] {
  const out: unknown[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      out.push({
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: m.toolCallId, content: m.content },
        ],
      });
    } else if (m.role === "assistant") {
      const calls = (m.toolCalls ?? []) as {
        id: string;
        name: string;
        input: Record<string, unknown>;
      }[];
      const blocks: unknown[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const tc of calls) {
        blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });
      }
      out.push({ role: "assistant", content: blocks.length ? blocks : m.content });
    } else {
      out.push({ role: "user", content: m.content });
    }
  }
  return out;
}

/**
 * Same unified `chat` shape as the Ollama connector (model + prompt + system),
 * so chat/agents stay provider-agnostic — plus `maxTokens`, which the Anthropic
 * API requires.
 */
const chat: Capability = {
  name: "chat",
  title: "Chat",
  description: "Send a prompt to a Claude model and get a completion.",
  topic: "chat",
  readOnly: false,
  input: z.object({
    model: z.string().min(1),
    prompt: z.string().min(1),
    system: z.string().optional(),
    maxTokens: z.number().int().min(1).max(64000).default(1024),
  }),
  handler: async (ctx, input) => {
    const { model, prompt, system, maxTokens } = input as {
      model: string;
      prompt: string;
      system?: string;
      maxTokens: number;
    };
    const res = await anthropicPost<AnthropicMessage>(ctx, "/v1/messages", {
      model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: [{ role: "user", content: prompt }],
    });
    const content = (res.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    return { model: res.model, content };
  },
};

function textOf(res: AnthropicMessage): string {
  return (res.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
}

function toolCallsOf(res: AnthropicMessage) {
  return (res.content ?? [])
    .filter((b) => b.type === "tool_use")
    .map((b) => ({ id: b.id ?? "", name: b.name ?? "", input: b.input ?? {} }));
}

const listModels: Capability = {
  name: "list_models",
  title: "List models",
  description: "List the Claude models available to this API key.",
  topic: "models",
  readOnly: true,
  input: z.object({}),
  handler: async (ctx) => {
    const res = await anthropicGet<AnthropicModels>(ctx, "/v1/models");
    return (res.data ?? []).map((m) => ({
      name: m.id,
      displayName: m.display_name ?? m.id,
    }));
  },
};

export const anthropicConnector: ConnectorDefinition<
  AnthropicConfig,
  AnthropicCredentials
> = {
  type: "anthropic",
  layer: "model",
  displayName: "Anthropic",
  description: "Claude models via the Anthropic API (chat, model listing).",
  icon: "anthropic",
  configSchema,
  credentialsSchema,
  capabilities: [chat, listModels],
  api: {
    baseUrl: "https://api.anthropic.com",
    operations: [
      {
        id: "messages",
        topic: "chat",
        method: "POST",
        path: "/v1/messages",
        summary: "Create a message (chat completion)",
        docsUrl: "https://docs.anthropic.com/en/api/messages",
      },
      {
        id: "models.list",
        topic: "models",
        method: "GET",
        path: "/v1/models",
        summary: "List available models",
        docsUrl: "https://docs.anthropic.com/en/api/models-list",
      },
    ],
    request: anthropicRawRequest,
  },
  model: {
    chat: async (ctx, input) => {
      // Anthropic: system is a top-level field; tool/assistant turns map to
      // tool_result / tool_use content blocks.
      const res = await anthropicPost<AnthropicMessage>(ctx, "/v1/messages", {
        model: input.model,
        max_tokens: input.maxTokens ?? 1024,
        ...(input.system ? { system: input.system } : {}),
        ...(input.tools?.length
          ? {
              tools: input.tools.map((t) => ({
                name: t.name,
                description: t.description,
                input_schema: t.inputSchema,
              })),
            }
          : {}),
        messages: toAnthropicMessages(input.messages),
      });
      const toolCalls = toolCallsOf(res);
      return {
        model: res.model,
        content: textOf(res),
        ...(toolCalls.length ? { toolCalls } : {}),
      };
    },
    chatStream: async function* (ctx, input) {
      const body = await anthropicFetchStream(ctx, "/v1/messages", {
        model: input.model,
        max_tokens: input.maxTokens ?? 1024,
        ...(input.system ? { system: input.system } : {}),
        messages: input.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      });
      for await (const line of readLines(body)) {
        const l = line.trim();
        if (!l.startsWith("data:")) continue;
        const data = l.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        let obj: {
          type?: string;
          delta?: { type?: string; text?: string };
        };
        try {
          obj = JSON.parse(data);
        } catch {
          continue;
        }
        if (
          obj.type === "content_block_delta" &&
          obj.delta?.type === "text_delta" &&
          typeof obj.delta.text === "string"
        ) {
          yield obj.delta.text;
        }
        if (obj.type === "message_stop") return;
      }
    },
    chatTurnStream: async function* (ctx, input): AsyncGenerator<
      string,
      ToolCall[],
      void
    > {
      const body = await anthropicFetchStream(ctx, "/v1/messages", {
        model: input.model,
        max_tokens: input.maxTokens ?? 1024,
        ...(input.system ? { system: input.system } : {}),
        ...(input.tools?.length
          ? {
              tools: input.tools.map((t) => ({
                name: t.name,
                description: t.description,
                input_schema: t.inputSchema,
              })),
            }
          : {}),
        messages: toAnthropicMessages(input.messages),
        stream: true,
      });
      // Accumulate streamed tool_use blocks (input arrives as partial JSON).
      const blocks: Record<number, { id: string; name: string; json: string }> =
        {};
      for await (const line of readLines(body)) {
        const l = line.trim();
        if (!l.startsWith("data:")) continue;
        const data = l.slice(5).trim();
        if (!data) continue;
        let ev: {
          type?: string;
          index?: number;
          content_block?: { type?: string; id?: string; name?: string };
          delta?: { type?: string; text?: string; partial_json?: string };
        };
        try {
          ev = JSON.parse(data);
        } catch {
          continue;
        }
        if (ev.type === "content_block_start") {
          const cb = ev.content_block;
          if (cb?.type === "tool_use" && ev.index !== undefined) {
            blocks[ev.index] = { id: cb.id ?? "", name: cb.name ?? "", json: "" };
          }
        } else if (ev.type === "content_block_delta" && ev.index !== undefined) {
          if (ev.delta?.type === "text_delta" && ev.delta.text) {
            yield ev.delta.text;
          } else if (ev.delta?.type === "input_json_delta") {
            const blk = blocks[ev.index];
            if (blk) blk.json += ev.delta.partial_json ?? "";
          }
        } else if (ev.type === "message_stop") {
          break;
        }
      }
      return Object.values(blocks).map((b) => {
        let input: Record<string, unknown> = {};
        try {
          input = b.json ? JSON.parse(b.json) : {};
        } catch {
          input = {};
        }
        return { id: b.id, name: b.name, input };
      });
    },
  },
  testConnection: async (ctx) => {
    // /v1/models validates the API key (401 if invalid).
    await anthropicGet(ctx, "/v1/models");
  },
};

export default anthropicConnector;
