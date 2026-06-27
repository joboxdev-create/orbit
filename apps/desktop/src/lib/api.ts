// Client for the local engine sidecar (the desktop's filesystem-backed host).
const BASE = import.meta.env.VITE_SIDECAR_URL ?? "http://127.0.0.1:4317";

export interface Project {
  id: string;
  orgId: string | null;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
}

export interface ConnectorInstance {
  id: string;
  projectId: string;
  connectorType: string;
  layer: string;
  name: string;
  status: string;
  config: Record<string, unknown>;
  /** Curated capabilities (by name) excluded from the project's chat tool pool. */
  disabledCapabilities: string[];
  createdAt: string;
}

export interface CatalogEntry {
  type: string;
  layer: string;
  displayName: string;
  description: string;
  icon: string | null;
  capabilities: number;
  apiOperations: number;
}

export interface RegisterConnectorInput {
  source: "catalog" | "custom";
  name: string;
  connectorType?: string;
  layer?: string;
  config?: Record<string, unknown>;
}

// Minimal JSON Schema shape we render forms from (zod-to-json-schema output).
export interface JsonSchemaProp {
  type?: string;
  enum?: string[];
  default?: unknown;
  description?: string;
  format?: string;
}
export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchemaProp>;
  required?: string[];
}
export interface CapabilitySchema {
  name: string;
  title: string;
  description: string;
  topic: string;
  readOnly: boolean;
  input: JsonSchema;
}
export interface ApiParam {
  name: string;
  in: "path" | "query" | "header";
  required: boolean;
  description?: string;
  schema?: JsonSchemaProp;
}
export interface ApiOperation {
  id: string;
  topic: string;
  method: string;
  path: string;
  summary: string;
  docsUrl?: string;
  parameters?: ApiParam[];
  requestSchema?: JsonSchema;
}
export interface ApiCatalogSchema {
  baseUrl: string | null;
  /** Whether the Tier-2 generic invoker is available for this connector. */
  canCall: boolean;
  operations: ApiOperation[];
}
export interface OfficialMcpSpec {
  transport: McpTransport;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  secretKeys?: string[];
  description?: string;
  docsUrl?: string;
}
export interface ConnectorSchema {
  type: string;
  displayName: string;
  config: JsonSchema;
  credentials: JsonSchema;
  capabilities: CapabilitySchema[];
  api: ApiCatalogSchema;
  officialMcp: OfficialMcpSpec | null;
}
export interface CallApiInput {
  operationId?: string;
  method?: string;
  path?: string;
  pathParams?: Record<string, string | number>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}
export interface SavedRequest {
  id: string;
  projectId: string;
  instanceId: string;
  name: string;
  topic: string;
  operationId?: string;
  method?: string;
  path?: string;
  pathParams?: Record<string, string | number>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  createdAt: string;
}
export type SaveRequestInput = Omit<
  SavedRequest,
  "id" | "projectId" | "instanceId" | "createdAt"
>;
export interface McpConfig {
  key: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  /** Whether the underlying capability is read-only (no confirmation needed). */
  readOnly?: boolean;
}
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  toolName?: string;
}
export interface ChatResult {
  model: string;
  content: string;
}
export interface Conversation {
  id: string;
  projectId: string;
  title: string;
  instanceId?: string;
  model?: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}
export interface RawApiResponse {
  status: number;
  data: unknown;
}
export type McpTransport = "stdio" | "http" | "sse";
export interface McpServer {
  id: string;
  projectId: string;
  connectorInstanceId: string;
  name: string;
  transport: McpTransport;
  command: string;
  args: string[];
  env: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  status: "configured" | "connected" | "error";
  enabled: boolean;
  toolCount?: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}
export interface CreateMcpServerInput {
  name: string;
  transport?: McpTransport;
  // stdio
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  secretEnv?: Record<string, string>;
  // http / sse
  url?: string;
  headers?: Record<string, string>;
  secretHeaders?: Record<string, string>;
}
export interface McpToolDescriptor {
  name: string;
  description?: string;
  inputSchema: unknown;
  readOnly: boolean;
}
/** A server found in another client's config on this machine (read-only). */
export interface DiscoveredMcpServer {
  source: string;
  sourcePath: string;
  name: string;
  transport: McpTransport;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  health: () => req<{ ok: boolean; workspace: string }>("/health"),
  listProjects: () => req<Project[]>("/projects"),
  createProject: (input: { name: string; slug: string; description?: string }) =>
    req<Project>("/projects", { method: "POST", body: JSON.stringify(input) }),
  updateProject: (
    id: string,
    input: { name?: string; slug?: string; description?: string },
  ) =>
    req<Project>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteProject: (id: string) =>
    req<void>(`/projects/${id}`, { method: "DELETE" }),
  catalog: () => req<CatalogEntry[]>("/connectors/catalog"),
  listConnectors: (projectId: string) =>
    req<ConnectorInstance[]>(`/projects/${projectId}/connectors`),
  registerConnector: (projectId: string, input: RegisterConnectorInput) =>
    req<ConnectorInstance>(`/projects/${projectId}/connectors`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateConnector: (
    id: string,
    input: {
      name?: string;
      layer?: string;
      config?: Record<string, unknown>;
      disabledCapabilities?: string[];
    },
  ) =>
    req<ConnectorInstance>(`/connectors/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteConnector: (id: string) =>
    req<void>(`/connectors/${id}`, { method: "DELETE" }),
  connectorSchema: (type: string) =>
    req<ConnectorSchema>(`/connectors/catalog/${type}/schema`),
  connect: (id: string, credentials: Record<string, unknown>) =>
    req<ConnectorInstance>(`/connectors/${id}/connect`, {
      method: "POST",
      body: JSON.stringify(credentials),
    }),
  disconnect: (id: string) =>
    req<ConnectorInstance>(`/connectors/${id}/disconnect`, { method: "POST" }),
  invoke: (id: string, capability: string, input: Record<string, unknown>) =>
    req<{ capability: string; result: unknown }>(
      `/connectors/${id}/capabilities/${capability}`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  callApi: (id: string, input: CallApiInput) =>
    req<RawApiResponse>(`/connectors/${id}/api`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  listSavedRequests: (instanceId: string) =>
    req<SavedRequest[]>(`/connectors/${instanceId}/saved-requests`),
  saveRequest: (instanceId: string, input: SaveRequestInput) =>
    req<SavedRequest>(`/connectors/${instanceId}/saved-requests`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  deleteSavedRequest: (id: string) =>
    req<void>(`/saved-requests/${id}`, { method: "DELETE" }),
  mcpConfig: (instanceId: string) =>
    req<McpConfig>(`/connectors/${instanceId}/mcp-config`),
  chat: (
    instanceId: string,
    input: {
      model: string;
      messages: ChatMessage[];
      system?: string;
      maxTokens?: number;
    },
  ) =>
    req<ChatResult>(`/connectors/${instanceId}/chat`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  /** Streaming chat: calls onDelta with the accumulated text; returns the full text. */
  chatStream: async (
    instanceId: string,
    input: {
      model: string;
      messages: ChatMessage[];
      system?: string;
      maxTokens?: number;
    },
    onDelta: (full: string) => void,
  ): Promise<string> => {
    const res = await fetch(`${BASE}/connectors/${instanceId}/chat/stream`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(body?.error ?? `Request failed (${res.status})`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      full += decoder.decode(value, { stream: true });
      onDelta(full);
    }
    return full;
  },
  /** One model turn with the project's tools — returns text + requested tool calls. */
  chatTurn: (
    instanceId: string,
    input: { model: string; messages: ChatMessage[]; system?: string; maxTokens?: number },
  ) =>
    req<{ content: string; toolCalls: ToolCall[] }>(
      `/connectors/${instanceId}/chat/turn`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  /** Streaming model turn: onText gets the accumulated text; resolves with text + tool calls. */
  chatTurnStream: async (
    instanceId: string,
    input: { model: string; messages: ChatMessage[]; system?: string; maxTokens?: number },
    onText: (acc: string) => void,
  ): Promise<{ content: string; toolCalls: ToolCall[] }> => {
    const res = await fetch(
      `${BASE}/connectors/${instanceId}/chat/turn/stream`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(body?.error ?? `Request failed (${res.status})`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    let toolCalls: ToolCall[] = [];
    const handle = (line: string) => {
      if (!line.trim()) return;
      let ev: { type?: string; value?: unknown };
      try {
        ev = JSON.parse(line);
      } catch {
        return;
      }
      if (ev.type === "text") {
        content += ev.value as string;
        onText(content);
      } else if (ev.type === "tools") {
        toolCalls = ev.value as ToolCall[];
      } else if (ev.type === "error") {
        throw new Error(ev.value as string);
      }
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        handle(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
      }
    }
    if (buffer) handle(buffer);
    return { content, toolCalls };
  },
  /** Execute a tool (by namespaced name) on the right connector. */
  runTool: (
    instanceId: string,
    name: string,
    input: Record<string, unknown>,
  ) =>
    req<{ result: unknown }>(`/connectors/${instanceId}/run-tool`, {
      method: "POST",
      body: JSON.stringify({ name, input }),
    }),
  listConversations: (projectId: string) =>
    req<Conversation[]>(`/projects/${projectId}/conversations`),
  createConversation: (
    projectId: string,
    input: {
      title?: string;
      instanceId?: string;
      model?: string;
      messages?: ChatMessage[];
    },
  ) =>
    req<Conversation>(`/projects/${projectId}/conversations`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateConversation: (
    id: string,
    patch: {
      title?: string;
      instanceId?: string;
      model?: string;
      messages?: ChatMessage[];
    },
  ) =>
    req<Conversation>(`/conversations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteConversation: (id: string) =>
    req<void>(`/conversations/${id}`, { method: "DELETE" }),
  // ── MCP servers (inbound tool sources, owned by a connector instance) ────
  discoverMcpServers: () =>
    req<DiscoveredMcpServer[]>(`/mcp/discover`),
  listProjectMcpServers: (projectId: string) =>
    req<McpServer[]>(`/projects/${projectId}/mcp-servers`),
  listMcpServers: (connectorInstanceId: string) =>
    req<McpServer[]>(`/connectors/${connectorInstanceId}/mcp-servers`),
  createMcpServer: (
    connectorInstanceId: string,
    input: CreateMcpServerInput,
  ) =>
    req<McpServer>(`/connectors/${connectorInstanceId}/mcp-servers`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateMcpServer: (
    id: string,
    patch: {
      name?: string;
      transport?: McpTransport;
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      url?: string;
      headers?: Record<string, string>;
      enabled?: boolean;
    },
  ) =>
    req<McpServer>(`/mcp-servers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  setMcpServerEnabled: (id: string, enabled: boolean) =>
    req<McpServer>(`/mcp-servers/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }),
  deleteMcpServer: (id: string) =>
    req<void>(`/mcp-servers/${id}`, { method: "DELETE" }),
  connectMcpServer: (
    id: string,
    secrets?: {
      secretEnv?: Record<string, string>;
      secretHeaders?: Record<string, string>;
    },
  ) =>
    req<McpServer>(`/mcp-servers/${id}/connect`, {
      method: "POST",
      body: JSON.stringify(secrets ?? {}),
    }),
  disconnectMcpServer: (id: string) =>
    req<McpServer>(`/mcp-servers/${id}/disconnect`, { method: "POST" }),
  mcpServerTools: (id: string) =>
    req<McpToolDescriptor[]>(`/mcp-servers/${id}/tools`),
};
