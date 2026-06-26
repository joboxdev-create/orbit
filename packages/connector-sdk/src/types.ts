import type { LayerKind } from "@orbit/shared";
import type { z } from "zod";

/**
 * Runtime context handed to a connector when it executes. It carries the
 * resolved (non-secret) config, the resolved credentials, and a fetch
 * implementation so connectors never import an HTTP client of their own.
 */
export interface ConnectorContext<
  Config = Record<string, unknown>,
  Credentials = Record<string, unknown>,
> {
  config: Config;
  credentials: Credentials;
  fetch: typeof fetch;
  /** Structured logger; connectors should not use console directly. */
  logger: ConnectorLogger;
}

export interface ConnectorLogger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

/**
 * A Capability is a single mapped action. It is the unit that gets exposed
 * BOTH as an MCP tool (for agents) AND as a direct invocation (for the UI,
 * without AI). Map it once here, use it everywhere.
 */
export interface Capability<Input = unknown, Output = unknown> {
  /** Stable, snake_case name; becomes the MCP tool name when exposed. */
  name: string;
  title: string;
  description: string;
  /** Grouping for the UI / API catalog, e.g. "issues", "repos". */
  topic: string;
  /** Input contract; also serialized to JSON Schema for MCP. The `any` input
   * position lets schemas use `.default()`/`.transform()` without variance errors. */
  input: z.ZodType<Input, z.ZodTypeDef, any>;
  output?: z.ZodType<Output, z.ZodTypeDef, any>;
  /** Read-only actions are safe defaults for agents and permission checks. */
  readOnly: boolean;
  /** Whether this capability is published as an MCP tool. Default true. */
  exposeAsTool?: boolean;
  handler: (ctx: ConnectorContext, input: Input) => Promise<Output>;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * A declarative description of a raw service endpoint. This is the "API list"
 * the user asked for: discoverable, grouped by topic, and callable directly
 * (fetch) independently from the MCP/capability layer.
 */
/** A single path/query/header parameter of an {@link ApiOperation}. */
export interface ApiParam {
  name: string;
  in: "path" | "query" | "header";
  required: boolean;
  description?: string;
  /** Loose JSON Schema for the value (type/enum/…), as produced from OpenAPI. */
  schema?: Record<string, unknown>;
}

export interface ApiOperation {
  id: string;
  topic: string;
  method: HttpMethod;
  /** Path template relative to ApiCatalog.baseUrl, e.g. "/repos/{owner}/{repo}". */
  path: string;
  summary: string;
  docsUrl?: string;
  /** Path/query parameters (from the OpenAPI description). */
  parameters?: ApiParam[];
  /** Loose JSON Schema of the request body, if any. */
  requestSchema?: Record<string, unknown>;
}

/**
 * A raw, already-resolved request against a service's API — path params are
 * substituted, query is explicit. This is the input to the generic (Tier-2)
 * "call any operation" path that sits on top of the declarative `operations`.
 */
export interface RawApiRequest {
  method: HttpMethod;
  /** Path relative to ApiCatalog.baseUrl, with path params already filled in. */
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

export interface RawApiResponse {
  status: number;
  data: unknown;
}

export interface ApiCatalog {
  baseUrl: string;
  operations: ApiOperation[];
  /**
   * Optional executor performing an authenticated raw request, reusing the same
   * credentials as capabilities. When present, the host can invoke ANY declared
   * operation generically (Tier-2) without a hand-written capability. When
   * absent, `operations` is discovery-only.
   */
  request?: (
    ctx: ConnectorContext,
    req: RawApiRequest,
  ) => Promise<RawApiResponse>;
}

export interface ToolCall {
  /** Provider-issued id, echoed back with the result. */
  id: string;
  /** Tool name (namespaced `connectorType__capability`). */
  name: string;
  input: Record<string, unknown>;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** On assistant turns: tools the model requested. */
  toolCalls?: ToolCall[];
  /** On `tool` messages: which tool call this result answers. */
  toolCallId?: string;
  toolName?: string;
}

/** A tool offered to the model (derived from a connector capability). */
export interface ModelTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ModelChatInput {
  model: string;
  messages: ChatMessage[];
  /** Separate system prompt; each provider places it where it belongs. */
  system?: string;
  maxTokens?: number;
  /** Tools the model may call this turn. */
  tools?: ModelTool[];
}

export interface ModelChatResult {
  model: string;
  content: string;
  /** Non-empty when the model wants to call tools before answering. */
  toolCalls?: ToolCall[];
}

/**
 * The optional model-provider face of a connector (layer "model"): a multi-turn
 * chat interface for Orbit's internal chat/agent. It is distinct from the
 * single-prompt `chat` Capability — which stays flat and form-friendly for
 * quick tests — and is the seam where tool-use (the agent) will later plug in.
 */
export interface ModelProvider {
  chat(
    ctx: ConnectorContext,
    input: ModelChatInput,
  ): Promise<ModelChatResult>;
  /** Optional streaming: yields text deltas as they arrive. Hosts fall back to
   *  `chat` (one chunk) when a provider doesn't implement it. */
  chatStream?(
    ctx: ConnectorContext,
    input: ModelChatInput,
  ): AsyncIterable<string>;
  /** Optional streaming turn for tool-use: yields text deltas, then returns the
   *  tool calls the model requested (for the host's agentic loop). */
  chatTurnStream?(
    ctx: ConnectorContext,
    input: ModelChatInput,
  ): AsyncGenerator<string, ToolCall[] | void, void>;
}

/**
 * The full contract a connector package (@orbit/connector-*) must export.
 * The core depends only on this type, never on the connector implementation.
 */
export interface ConnectorDefinition<
  Config = Record<string, unknown>,
  Credentials = Record<string, unknown>,
> {
  /** Stable id, e.g. "github". Matches ConnectorInstance.connectorType. */
  type: string;
  layer: LayerKind;
  displayName: string;
  description: string;
  /** Simple Icons slug for the brand logo (e.g. "github", "gitlab", "jira"). */
  icon?: string;
  /** Non-secret configuration shape (org name, base url, ...). */
  configSchema: z.ZodType<Config, z.ZodTypeDef, any>;
  /** Secret credentials shape (token, key, ...). Stored encrypted by core. */
  credentialsSchema: z.ZodType<Credentials, z.ZodTypeDef, any>;
  capabilities: Capability[];
  /** Optional raw API catalog for direct fetch + discovery. */
  api?: ApiCatalog;
  /** Optional model-provider face (layer "model"): multi-turn chat for the
   *  internal chat/agent. */
  model?: ModelProvider;
  /** Lightweight connectivity check used when configuring an instance. */
  testConnection: (ctx: ConnectorContext<Config, Credentials>) => Promise<void>;
}
