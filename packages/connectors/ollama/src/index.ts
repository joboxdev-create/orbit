import type {
  Capability,
  ConnectorDefinition,
  ToolCall,
} from "@orbit/connector-sdk";
import { z } from "zod";
import {
  ollamaFetchStream,
  ollamaGet,
  ollamaPost,
  ollamaRawRequest,
  readLines,
  type OllamaConfig,
  type OllamaCredentials,
} from "./client.js";

const configSchema = z.object({
  baseUrl: z.string().url().default("http://localhost:11434"),
});

const credentialsSchema = z.object({
  // Local Ollama needs none; a fronting proxy may require a bearer token.
  apiKey: z.string().min(1).optional(),
});

// --- raw API shapes (only the fields we surface) ---
interface OllamaToolCall {
  function?: { name?: string; arguments?: Record<string, unknown> | string };
}

interface OllamaChatResponse {
  model: string;
  message?: {
    role: string;
    content?: string;
    tool_calls?: OllamaToolCall[];
  };
}

interface OllamaTags {
  models: { name: string; model?: string; size?: number }[];
}

/** Map Orbit's unified messages to the Ollama chat format (tool calls/results). */
function toOllamaMessages(
  messages: {
    role: string;
    content: string;
    toolCalls?: { name: string; input: Record<string, unknown> }[];
    toolName?: string;
  }[],
  system?: string,
): unknown[] {
  const out: unknown[] = [];
  if (system) out.push({ role: "system", content: system });
  for (const m of messages) {
    if (m.role === "tool") {
      out.push({
        role: "tool",
        content: m.content,
        ...(m.toolName ? { tool_name: m.toolName } : {}),
      });
    } else if (m.role === "assistant") {
      const calls = m.toolCalls ?? [];
      out.push({
        role: "assistant",
        content: m.content ?? "",
        ...(calls.length
          ? {
              tool_calls: calls.map((tc) => ({
                function: { name: tc.name, arguments: tc.input },
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

/**
 * Unified `chat` capability: a flat, form-friendly shape (model + prompt +
 * optional system) that the same way maps onto every model provider — so chat
 * and agents can stay provider-agnostic. Richer message arrays can come later.
 */
const chat: Capability = {
  name: "chat",
  title: "Chat",
  description: "Send a prompt to a model and get a completion.",
  topic: "chat",
  readOnly: false,
  input: z.object({
    model: z.string().min(1),
    prompt: z.string().min(1),
    system: z.string().optional(),
  }),
  handler: async (ctx, input) => {
    const { model, prompt, system } = input as {
      model: string;
      prompt: string;
      system?: string;
    };
    const messages: { role: string; content: string }[] = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: prompt });
    const res = await ollamaPost<OllamaChatResponse>(ctx, "/api/chat", {
      model,
      messages,
      stream: false,
    });
    return { model: res.model, content: res.message?.content ?? "" };
  },
};

const listModels: Capability = {
  name: "list_models",
  title: "List models",
  description: "List the models available on this Ollama server.",
  topic: "models",
  readOnly: true,
  input: z.object({}),
  handler: async (ctx) => {
    const res = await ollamaGet<OllamaTags>(ctx, "/api/tags");
    return (res.models ?? []).map((m) => ({ name: m.name, size: m.size }));
  },
};

export const ollamaConnector: ConnectorDefinition<
  OllamaConfig,
  OllamaCredentials
> = {
  type: "ollama",
  layer: "model",
  displayName: "Ollama",
  description: "Local LLMs served by Ollama (chat, embeddings, model listing).",
  icon: "ollama",
  configSchema,
  credentialsSchema,
  capabilities: [chat, listModels],
  api: {
    baseUrl: "http://localhost:11434",
    operations: [
      {
        id: "chat",
        topic: "chat",
        method: "POST",
        path: "/api/chat",
        summary: "Generate a chat completion",
        docsUrl:
          "https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-chat-completion",
      },
      {
        id: "generate",
        topic: "chat",
        method: "POST",
        path: "/api/generate",
        summary: "Generate a completion",
        docsUrl:
          "https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-completion",
      },
      {
        id: "tags",
        topic: "models",
        method: "GET",
        path: "/api/tags",
        summary: "List local models",
        docsUrl:
          "https://github.com/ollama/ollama/blob/main/docs/api.md#list-local-models",
      },
      {
        id: "embed",
        topic: "embeddings",
        method: "POST",
        path: "/api/embed",
        summary: "Generate embeddings",
        docsUrl:
          "https://github.com/ollama/ollama/blob/main/docs/api.md#generate-embeddings",
      },
    ],
    request: ollamaRawRequest,
  },
  model: {
    chat: async (ctx, input) => {
      const res = await ollamaPost<OllamaChatResponse>(ctx, "/api/chat", {
        model: input.model,
        messages: toOllamaMessages(input.messages, input.system),
        stream: false,
        ...(input.tools?.length
          ? {
              tools: input.tools.map((t) => ({
                type: "function",
                function: {
                  name: t.name,
                  description: t.description,
                  parameters: t.inputSchema,
                },
              })),
            }
          : {}),
      });
      const calls = res.message?.tool_calls ?? [];
      const toolCalls = calls.map((tc, i) => {
        const args = tc.function?.arguments;
        let input: Record<string, unknown> = {};
        if (typeof args === "string") {
          try {
            input = JSON.parse(args);
          } catch {
            input = {};
          }
        } else if (args) {
          input = args;
        }
        return { id: `call_${i}`, name: tc.function?.name ?? "", input };
      });
      return {
        model: res.model,
        content: res.message?.content ?? "",
        ...(toolCalls.length ? { toolCalls } : {}),
      };
    },
    chatStream: async function* (ctx, input) {
      const messages = input.system
        ? [{ role: "system", content: input.system }, ...input.messages]
        : input.messages;
      const body = await ollamaFetchStream(ctx, "/api/chat", {
        model: input.model,
        messages,
        stream: true,
      });
      for await (const line of readLines(body)) {
        if (!line.trim()) continue;
        let obj: { message?: { content?: string }; done?: boolean };
        try {
          obj = JSON.parse(line);
        } catch {
          continue;
        }
        if (obj.message?.content) yield obj.message.content;
        if (obj.done) return;
      }
    },
    chatTurnStream: async function* (ctx, input): AsyncGenerator<
      string,
      ToolCall[],
      void
    > {
      const body = await ollamaFetchStream(ctx, "/api/chat", {
        model: input.model,
        messages: toOllamaMessages(input.messages, input.system),
        stream: true,
        ...(input.tools?.length
          ? {
              tools: input.tools.map((t) => ({
                type: "function",
                function: {
                  name: t.name,
                  description: t.description,
                  parameters: t.inputSchema,
                },
              })),
            }
          : {}),
      });
      const toolCalls: ToolCall[] = [];
      let i = 0;
      for await (const line of readLines(body)) {
        if (!line.trim()) continue;
        let obj: {
          message?: { content?: string; tool_calls?: OllamaToolCall[] };
          done?: boolean;
        };
        try {
          obj = JSON.parse(line);
        } catch {
          continue;
        }
        if (obj.message?.content) yield obj.message.content;
        for (const tc of obj.message?.tool_calls ?? []) {
          const args = tc.function?.arguments;
          let input: Record<string, unknown> = {};
          if (typeof args === "string") {
            try {
              input = JSON.parse(args);
            } catch {
              input = {};
            }
          } else if (args) {
            input = args;
          }
          toolCalls.push({ id: `call_${i++}`, name: tc.function?.name ?? "", input });
        }
        if (obj.done) break;
      }
      return toolCalls;
    },
  },
  testConnection: async (ctx) => {
    // /api/tags responds on a running Ollama, with or without a token.
    await ollamaGet(ctx, "/api/tags");
  },
};

export default ollamaConnector;
