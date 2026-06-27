// An McpServer is an *external tool source* a project connects to over the
// Model Context Protocol. Unlike a ConnectorInstance (code-backed, statically
// typed capabilities), its tools are discovered at runtime via `tools/list`.
// It is a workspace artifact like a Conversation or SavedRequest: it lives in
// `.orbit/mcp-servers/<id>.json`, is sync-friendly, and holds NO secrets.
//
// Secret values (env tokens for stdio, auth headers for http/sse) are kept out
// of this record — they go in the SecretStore keyed by the server id, exactly
// like connector credentials, and are merged in at connect time.

/** Transport used to reach the MCP server:
 *  - `stdio` — spawn a local process (`command`/`args`/`env`).
 *  - `http`  — Streamable HTTP (modern remote transport), at `url`.
 *  - `sse`   — legacy Server-Sent Events transport, at `url`.
 *  http/sse carry non-secret `headers` on the record; secret headers (e.g. a
 *  bearer token) live in the SecretStore, merged into the request headers. */
export type McpTransport = "stdio" | "http" | "sse";

export type McpServerStatus = "configured" | "connected" | "error";

export interface McpServer {
  id: string;
  projectId: string;
  /** The connector instance this MCP server is a surface of. Every MCP server
   *  is owned by an integration (code-backed or custom); there are no orphans. */
  connectorInstanceId: string;
  name: string;
  transport: McpTransport;
  // --- stdio transport ---
  /** Executable to spawn (e.g. "npx"). Empty for http/sse. */
  command: string;
  /** Arguments (e.g. ["-y", "@modelcontextprotocol/server-filesystem", "/path"]). */
  args: string[];
  /** Non-secret environment variables. Secret ones live in the SecretStore. */
  env: Record<string, string>;
  // --- http / sse transport ---
  /** Endpoint URL for http/sse transports. */
  url?: string;
  /** Non-secret request headers for http/sse. Secret headers (tokens) live in
   *  the SecretStore and are merged on top at connect time. */
  headers?: Record<string, string>;
  status: McpServerStatus;
  /** Whether this server's tools join the project's chat tool pool. A connected
   *  server can be disabled to keep its tools out of the agent (e.g. to avoid
   *  duplicates with a connector capability) without disconnecting it. Defaults
   *  to true; legacy records without the field are treated as enabled. */
  enabled: boolean;
  /** Number of tools advertised at the last successful connect. */
  toolCount?: number;
  /** Last connection error, when status is "error". */
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMcpServerData {
  projectId: string;
  connectorInstanceId: string;
  name: string;
  transport?: McpTransport;
  /** stdio: required. http/sse: omit. */
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  /** http/sse: required. */
  url?: string;
  headers?: Record<string, string>;
}

export interface UpdateMcpServerData {
  name?: string;
  /** Switch transport (stdio ↔ http ↔ sse) — fixes a mis-picked transport
   *  without recreating the server (keeps id, ownership, enabled). */
  transport?: McpTransport;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  status?: McpServerStatus;
  /** Toggle whether the server's tools join the chat pool. */
  enabled?: boolean;
  toolCount?: number;
  /** Pass null to clear the stored error. */
  lastError?: string | null;
}

export interface McpServerRepository {
  create(data: CreateMcpServerData): Promise<McpServer>;
  findById(id: string): Promise<McpServer | null>;
  /** Every MCP server in a project — used for the chat tool pool. */
  listByProject(projectId: string): Promise<McpServer[]>;
  /** The MCP servers owned by one connector instance — for its MCP tab. */
  listByConnectorInstance(connectorInstanceId: string): Promise<McpServer[]>;
  update(id: string, patch: UpdateMcpServerData): Promise<McpServer>;
  delete(id: string): Promise<void>;
}
