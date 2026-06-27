import type {
  Capability,
  ConnectorDefinition,
  ToolCall,
} from "@orbit/connector-sdk";
import { z } from "zod";
import {
  openAiFetchStream,
  openAiGet,
  openAiPost,
  openAiRawRequest,
  readLines,
  type OpenAiConfig,
  type OpenAiCredentials,
} from "./client.js";

const configSchema = z.object({
  baseUrl: z.string().url().default("https://api.openai.com/v1"),
});

const credentialsSchema = z.object({
  apiKey: z.string().min(1),
});

// --- raw API shapes (only the fields we surface) ---
interface OpenAiToolCallRaw {
  id?: string;
  index?: number;
  function?: { name?: string; arguments?: string };
}

interface OpenAiMessage {
  content?: string | null;
  tool_calls?: OpenAiToolCallRaw[];
}

interface OpenAiCompletion {
  model: string;
  choices?: { message?: OpenAiMessage; delta?: OpenAiMessage }[];
}

interface OpenAiModels {
  data: { id: string }[];
}

function parseArgs(s: string | undefined): Record<string, unknown> {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

/** Map Orbit's unified messages to the OpenAI chat-completions format. */
function toOpenAiMessages(
  messages: {
    role: string;
    content: string;
    toolCalls?: { id: string; name: string; input: Record<string, unknown> }[];
    toolCallId?: string;
  }[],
  system?: string,
): unknown[] {
  const out: unknown[] = [];
  if (system) out.push({ role: "system", content: system });
  for (const m of messages) {
    if (m.role === "tool") {
      out.push({ role: "tool", tool_call_id: m.toolCallId, content: m.content });
    } else if (m.role === "assistant") {
      const calls = m.toolCalls ?? [];
      out.push({
        role: "assistant",
        content: m.content || null,
        ...(calls.length
          ? {
              tool_calls: calls.map((tc) => ({
                id: tc.id,
                type: "function",
                function: { name: tc.name, arguments: JSON.stringify(tc.input) },
              })),
            }
          : {}),
      });
    } else {
      out.push({ role: m.role, content: m.content });
    }
  }
  return out;
}

function toOpenAiTools(
  tools: { name: string; description: string; inputSchema: Record<string, unknown> }[],
) {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

const chat: Capability = {
  name: "chat",
  title: "Chat",
  description: "Send a prompt to an OpenAI model and get a completion.",
  topic: "chat",
  readOnly: false,
  input: z.object({
    model: z.string().min(1),
    prompt: z.string().min(1),
    system: z.string().optional(),
    maxTokens: z.number().int().min(1).optional(),
  }),
  handler: async (ctx, input) => {
    const { model, prompt, system, maxTokens } = input as {
      model: string;
      prompt: string;
      system?: string;
      maxTokens?: number;
    };
    const messages: unknown[] = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: prompt });
    const res = await openAiPost<OpenAiCompletion>(ctx, "/chat/completions", {
      model,
      messages,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
    });
    return {
      model: res.model,
      content: res.choices?.[0]?.message?.content ?? "",
    };
  },
};

const listModels: Capability = {
  name: "list_models",
  title: "List models",
  description: "List the models available to this API key.",
  topic: "models",
  readOnly: true,
  input: z.object({}),
  handler: async (ctx) => {
    const res = await openAiGet<OpenAiModels>(ctx, "/models");
    return (res.data ?? []).map((m) => ({ name: m.id }));
  },
};

export const openaiConnector: ConnectorDefinition<
  OpenAiConfig,
  OpenAiCredentials
> = {
  type: "openai",
  layer: "model",
  displayName: "OpenAI",
  description: "GPT models via the OpenAI API (chat, tools, model listing).",
  icon: "openai",
  configSchema,
  credentialsSchema,
  capabilities: [chat, listModels],
  api: {
    baseUrl: "https://api.openai.com/v1",
    operations: [
      {
        id: "chat.completions",
        topic: "chat",
        method: "POST",
        path: "/chat/completions",
        summary: "Create a chat completion",
        docsUrl: "https://platform.openai.com/docs/api-reference/chat/create",
      },
      {
        id: "models.list",
        topic: "models",
        method: "GET",
        path: "/models",
        summary: "List available models",
        docsUrl: "https://platform.openai.com/docs/api-reference/models/list",
      },
    ],
    request: openAiRawRequest,
  },
  model: {
    chat: async (ctx, input) => {
      const res = await openAiPost<OpenAiCompletion>(ctx, "/chat/completions", {
        model: input.model,
        messages: toOpenAiMessages(input.messages, input.system),
        ...(input.maxTokens ? { max_tokens: input.maxTokens } : {}),
        ...(input.tools?.length ? { tools: toOpenAiTools(input.tools) } : {}),
      });
      const msg = res.choices?.[0]?.message;
      const toolCalls = (msg?.tool_calls ?? []).map((tc) => ({
        id: tc.id ?? "",
        name: tc.function?.name ?? "",
        input: parseArgs(tc.function?.arguments),
      }));
      return {
        model: res.model,
        content: msg?.content ?? "",
        ...(toolCalls.length ? { toolCalls } : {}),
      };
    },
    chatStream: async function* (ctx, input) {
      const body = await openAiFetchStream(ctx, "/chat/completions", {
        model: input.model,
        messages: toOpenAiMessages(input.messages, input.system),
        stream: true,
        ...(input.maxTokens ? { max_tokens: input.maxTokens } : {}),
      });
      for await (const line of readLines(body)) {
        const l = line.trim();
        if (!l.startsWith("data:")) continue;
        const data = l.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        let obj: OpenAiCompletion;
        try {
          obj = JSON.parse(data);
        } catch {
          continue;
        }
        const delta = obj.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      }
    },
    chatTurnStream: async function* (ctx, input): AsyncGenerator<
      string,
      ToolCall[],
      void
    > {
      const body = await openAiFetchStream(ctx, "/chat/completions", {
        model: input.model,
        messages: toOpenAiMessages(input.messages, input.system),
        stream: true,
        ...(input.maxTokens ? { max_tokens: input.maxTokens } : {}),
        ...(input.tools?.length ? { tools: toOpenAiTools(input.tools) } : {}),
      });
      const calls: Record<number, { id: string; name: string; args: string }> =
        {};
      for await (const line of readLines(body)) {
        const l = line.trim();
        if (!l.startsWith("data:")) continue;
        const data = l.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        let obj: OpenAiCompletion;
        try {
          obj = JSON.parse(data);
        } catch {
          continue;
        }
        const delta = obj.choices?.[0]?.delta;
        if (delta?.content) yield delta.content;
        for (const tcd of delta?.tool_calls ?? []) {
          const idx = tcd.index ?? 0;
          const cur = calls[idx] ?? (calls[idx] = { id: "", name: "", args: "" });
          if (tcd.id) cur.id = tcd.id;
          if (tcd.function?.name) cur.name = tcd.function.name;
          if (tcd.function?.arguments) cur.args += tcd.function.arguments;
        }
      }
      return Object.values(calls).map((c) => ({
        id: c.id,
        name: c.name,
        input: parseArgs(c.args),
      }));
    },
  },
  testConnection: async (ctx) => {
    // /models validates the API key (401 if invalid).
    await openAiGet(ctx, "/models");
  },
};

export default openaiConnector;
