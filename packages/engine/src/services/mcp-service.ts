import type {
  McpServer,
  McpServerRepository,
} from "../domain/mcp-server.js";
import type { SecretStore } from "../domain/secret-store.js";
import { badRequest, EngineError, notFound } from "../errors.js";
import type { EngineLogger } from "./connector-instance-service.js";

/** A tool advertised by a connected MCP server (mapped from `tools/list`). */
export interface McpToolDescriptor {
  /** Raw tool name as the server reports it (namespacing is the caller's job). */
  name: string;
  description?: string;
  /** JSON Schema for the tool's arguments. */
  inputSchema: unknown;
  /** From the MCP `readOnlyHint` annotation. Absent/false ⇒ treat as mutating
   *  (host should confirm before running). */
  readOnly: boolean;
}

export interface McpServiceDeps {
  repo: McpServerRepository;
  /** Holds secret env vars (tokens) keyed by server id, merged in at spawn. */
  secrets?: SecretStore;
  logger?: EngineLogger;
}

// Minimal structural types for the parts of the MCP SDK we use, so this file
// type-checks without a static (ESM) import of the CJS-incompatible SDK. The
// real objects come from a lazy dynamic import (see {@link loadSdk}).
interface McpClient {
  connect(transport: unknown): Promise<void>;
  listTools(): Promise<{ tools: RawMcpTool[] }>;
  callTool(req: {
    name: string;
    arguments?: Record<string, unknown>;
  }): Promise<unknown>;
  close(): Promise<void>;
}

interface RawMcpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
  annotations?: { readOnlyHint?: boolean };
}

interface PooledClient {
  client: McpClient;
}

type ClientCtor = new (
  info: { name: string; version: string },
  opts: { capabilities: Record<string, unknown> },
) => McpClient;

type StdioTransportCtor = new (opts: {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}) => unknown;

/** Both HTTP transports take (url, { requestInit: { headers } }). */
type HttpTransportCtor = new (
  url: URL,
  opts?: { requestInit?: { headers?: Record<string, string> } },
) => unknown;

interface LoadedSdk {
  Client: ClientCtor;
  StdioClientTransport: StdioTransportCtor;
  StreamableHTTPClientTransport: HttpTransportCtor;
  SSEClientTransport: HttpTransportCtor;
  getDefaultEnvironment: () => Record<string, string>;
}

/**
 * Manages connections to *external* MCP servers (inbound tool sources). It keeps
 * a pool of live clients on the long-lived host process (the sidecar), spawning
 * each stdio server once and reusing it for `tools/list` and `tools/call`.
 *
 * The MCP SDK is ESM-only; the engine compiles to CommonJS. We bridge with a
 * lazy dynamic `import()` (NodeNext preserves it as a real import; esbuild
 * bundles it for the packaged binary).
 */
export class McpService {
  private readonly logger: EngineLogger;
  private readonly pool = new Map<string, PooledClient>();
  private sdk?: LoadedSdk;

  constructor(private readonly deps: McpServiceDeps) {
    this.logger =
      deps.logger ??
      ({
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      } as EngineLogger);
  }

  /** Lazy-load the ESM SDK once. Kept behind a method so nothing imports it at
   *  module-eval time (and only hosts that actually use MCP pay for it). */
  private async loadSdk(): Promise<LoadedSdk> {
    if (this.sdk) return this.sdk;
    const [clientMod, stdioMod, httpMod, sseMod] = await Promise.all([
      import("@modelcontextprotocol/sdk/client/index.js"),
      import("@modelcontextprotocol/sdk/client/stdio.js"),
      import("@modelcontextprotocol/sdk/client/streamableHttp.js"),
      import("@modelcontextprotocol/sdk/client/sse.js"),
    ]);
    this.sdk = {
      Client: clientMod.Client as unknown as ClientCtor,
      StdioClientTransport:
        stdioMod.StdioClientTransport as unknown as StdioTransportCtor,
      StreamableHTTPClientTransport:
        httpMod.StreamableHTTPClientTransport as unknown as HttpTransportCtor,
      SSEClientTransport:
        sseMod.SSEClientTransport as unknown as HttpTransportCtor,
      getDefaultEnvironment:
        stdioMod.getDefaultEnvironment as unknown as () => Record<
          string,
          string
        >,
    };
    return this.sdk;
  }

  /** Spawn/dial (if needed) and return a live client for a server. */
  private async clientFor(server: McpServer): Promise<McpClient> {
    const existing = this.pool.get(server.id);
    if (existing) return existing.client;

    const sdk = await this.loadSdk();
    const transport =
      server.transport === "stdio"
        ? await this.stdioTransport(server, sdk)
        : await this.httpTransport(server, sdk);

    const client = new sdk.Client(
      { name: "orbit", version: "0.1.0" },
      { capabilities: {} },
    ) as unknown as McpClient;

    try {
      await client.connect(transport);
    } catch (err) {
      throw new EngineError(
        "bad_request",
        `Failed to reach MCP server "${server.name}": ${(err as Error).message}`,
      );
    }
    this.pool.set(server.id, { client });
    this.logger.info(`mcp: connected ${server.name} (${server.id})`);
    return client;
  }

  /** Build a stdio transport, merging secret env vars from the SecretStore. */
  private async stdioTransport(
    server: McpServer,
    sdk: LoadedSdk,
  ): Promise<unknown> {
    if (!server.command) {
      throw badRequest(`MCP server "${server.name}" has no command`);
    }
    const secretEnv = (await this.secretValues(server.id)) as Record<
      string,
      string
    >;
    return new sdk.StdioClientTransport({
      command: server.command,
      args: server.args,
      env: { ...sdk.getDefaultEnvironment(), ...server.env, ...secretEnv },
    });
  }

  /** Build an http/sse transport, merging secret headers from the SecretStore. */
  private async httpTransport(
    server: McpServer,
    sdk: LoadedSdk,
  ): Promise<unknown> {
    if (!server.url) {
      throw badRequest(`MCP server "${server.name}" has no URL`);
    }
    let url: URL;
    try {
      url = new URL(server.url);
    } catch {
      throw badRequest(`Invalid MCP server URL: ${server.url}`);
    }
    const secretHeaders = (await this.secretValues(server.id)) as Record<
      string,
      string
    >;
    const headers = { ...server.headers, ...secretHeaders };
    const opts = Object.keys(headers).length
      ? { requestInit: { headers } }
      : undefined;
    const Ctor =
      server.transport === "sse"
        ? sdk.SSEClientTransport
        : sdk.StreamableHTTPClientTransport;
    return new Ctor(url, opts);
  }

  /** Secret values for a server (env vars for stdio, headers for http/sse). */
  private async secretValues(
    serverId: string,
  ): Promise<Record<string, unknown>> {
    if (!this.deps.secrets) return {};
    return (await this.deps.secrets.get(serverId)) ?? {};
  }

  private mapTools(tools: RawMcpTool[]): McpToolDescriptor[] {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema ?? { type: "object" },
      readOnly: t.annotations?.readOnlyHint === true,
    }));
  }

  /** List the tools of a *connected-in-pool* server (spawns it if needed). */
  async listTools(serverId: string): Promise<McpToolDescriptor[]> {
    const server = await this.requireServer(serverId);
    const client = await this.clientFor(server);
    const { tools } = await client.listTools();
    return this.mapTools(tools);
  }

  /**
   * Every *connected* server's tools for a project, for the chat tool pool.
   * Best-effort: a server that fails to respond (dead process, etc.) is skipped
   * rather than breaking the whole turn.
   */
  async listProjectTools(
    projectId: string,
  ): Promise<{ server: McpServer; tools: McpToolDescriptor[] }[]> {
    const servers = await this.deps.repo.listByProject(projectId);
    const out: { server: McpServer; tools: McpToolDescriptor[] }[] = [];
    for (const server of servers) {
      if (server.status !== "connected") continue;
      // A disabled server stays connected but contributes no tools to the agent.
      if (server.enabled === false) continue;
      try {
        out.push({ server, tools: await this.listTools(server.id) });
      } catch (err) {
        this.logger.warn(
          `mcp: listTools failed for ${server.name}: ${String(err)}`,
        );
      }
    }
    return out;
  }

  /**
   * Connect + list tools, persisting status/toolCount/lastError on the record.
   * This is the user-facing "Connect" action (and a health re-test).
   */
  async connect(serverId: string): Promise<McpServer> {
    const server = await this.requireServer(serverId);
    try {
      const client = await this.clientFor(server);
      const { tools } = await client.listTools();
      return await this.deps.repo.update(serverId, {
        status: "connected",
        toolCount: tools.length,
        lastError: null,
      });
    } catch (err) {
      await this.disposeOne(serverId);
      await this.deps.repo.update(serverId, {
        status: "error",
        lastError: (err as Error).message,
      });
      throw new EngineError(
        err instanceof EngineError ? err.kind : "bad_request",
        (err as Error).message,
      );
    }
  }

  /** Tear down the live process and mark the record configured. */
  async disconnect(serverId: string): Promise<McpServer> {
    await this.requireServer(serverId);
    await this.disposeOne(serverId);
    return this.deps.repo.update(serverId, {
      status: "configured",
      toolCount: 0,
      lastError: null,
    });
  }

  /** Call a tool on a server (raw tool name, no namespace). */
  async callTool(
    serverId: string,
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const server = await this.requireServer(serverId);
    const client = await this.clientFor(server);
    return client.callTool({ name, arguments: args });
  }

  /** Drop a single pooled client (best-effort close). */
  private async disposeOne(serverId: string): Promise<void> {
    const pooled = this.pool.get(serverId);
    if (!pooled) return;
    this.pool.delete(serverId);
    try {
      await pooled.client.close();
    } catch (err) {
      this.logger.warn(`mcp: error closing ${serverId}: ${String(err)}`);
    }
  }

  /** Close every live client — call on host shutdown. */
  async dispose(): Promise<void> {
    await Promise.all([...this.pool.keys()].map((id) => this.disposeOne(id)));
  }

  private async requireServer(serverId: string): Promise<McpServer> {
    const server = await this.deps.repo.findById(serverId);
    if (!server) throw notFound(`MCP server not found: ${serverId}`);
    return server;
  }
}
