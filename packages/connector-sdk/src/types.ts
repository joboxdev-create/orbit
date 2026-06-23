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
export interface ApiOperation {
  id: string;
  topic: string;
  method: HttpMethod;
  /** Path template relative to ApiCatalog.baseUrl, e.g. "/repos/{owner}/{repo}". */
  path: string;
  summary: string;
  docsUrl?: string;
}

export interface ApiCatalog {
  baseUrl: string;
  operations: ApiOperation[];
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
  /** Lightweight connectivity check used when configuring an instance. */
  testConnection: (ctx: ConnectorContext<Config, Credentials>) => Promise<void>;
}
