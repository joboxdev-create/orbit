// Orbit desktop sidecar: the engine's local host. It runs the same @orbit/engine
// domain logic as the server, but over the *filesystem* store (no DB), and
// exposes it as a tiny HTTP API on 127.0.0.1 for the Tauri webview / Vite dev
// server to call. Single-user, local-first: no auth, no organizations.
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ModelChatInput } from "@orbit/connector-sdk";
import {
  type CallApiInput,
  ConnectorInstanceService,
  ConversationService,
  type CreateConversationData,
  createDefaultRegistry,
  type CreateProjectData,
  type CreateSavedRequestData,
  EngineError,
  FsConnectorInstanceRepository,
  FsConversationRepository,
  FsProjectRepository,
  FsSavedRequestRepository,
  type RegisterConnectorInput,
  SavedRequestService,
  type UpdateConnectorInput,
  type UpdateConversationData,
  type UpdateProjectData,
} from "@orbit/engine";
import { zodToJsonSchema } from "zod-to-json-schema";
import { FileSecretStore } from "./fs-secret-store.js";

const WORKSPACE =
  process.env.ORBIT_WORKSPACE ?? join(homedir(), ".orbit-workspace");
const PORT = Number(process.env.PORT ?? 4317);

// App-level config (secrets + key), separate from the workspace (which only
// holds projects) so credentials never end up in a synced manifest.
const ORBIT_HOME = process.env.ORBIT_HOME ?? join(homedir(), ".orbit");

/** Load the local master key, generating one on first run. */
function loadOrCreateKey(keyPath: string): string {
  try {
    return readFileSync(keyPath, "utf8").trim();
  } catch {
    const key = randomBytes(32).toString("base64");
    mkdirSync(dirname(keyPath), { recursive: true });
    writeFileSync(keyPath, key, { mode: 0o600 });
    return key;
  }
}

const registry = createDefaultRegistry();
const projects = new FsProjectRepository(WORKSPACE);
const connectors = new FsConnectorInstanceRepository(WORKSPACE);
const secrets = new FileSecretStore(
  join(ORBIT_HOME, "secrets.json"),
  loadOrCreateKey(join(ORBIT_HOME, "secret.key")),
);
const connectorService = new ConnectorInstanceService({
  repo: connectors,
  registry,
  secrets,
  fetch: globalThis.fetch,
});
const savedRequests = new SavedRequestService(
  new FsSavedRequestRepository(WORKSPACE),
);
const conversations = new ConversationService(
  new FsConversationRepository(WORKSPACE),
);

function send(res: ServerResponse, status: number, body?: unknown): void {
  if (body === undefined) {
    res.writeHead(status);
    res.end();
    return;
  }
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {} as T;
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

function fail(res: ServerResponse, err: unknown): void {
  if (err instanceof EngineError) {
    const status =
      err.kind === "not_found"
        ? 404
        : err.kind === "conflict"
          ? 409
          : err.kind === "forbidden"
            ? 403
            : 400;
    send(res, status, { error: err.message });
    return;
  }
  send(res, 500, { error: (err as Error)?.message ?? "Internal error" });
}

/** Connector catalogue (available code-backed types), mirrors the server. */
function catalog() {
  return registry.list().map((def) => ({
    type: def.type,
    layer: def.layer,
    displayName: def.displayName,
    description: def.description,
    icon: def.icon ?? null,
    capabilities: def.capabilities.length,
    apiOperations: def.api?.operations.length ?? 0,
  }));
}

/** Connect-form schema (config + credentials) + capabilities of a connector. */
function connectorSchema(type: string) {
  const def = registry.get(type);
  if (!def) return null;
  return {
    type: def.type,
    displayName: def.displayName,
    config: zodToJsonSchema(def.configSchema),
    credentials: zodToJsonSchema(def.credentialsSchema),
    capabilities: def.capabilities.map((c) => ({
      name: c.name,
      title: c.title ?? c.name,
      description: c.description ?? "",
      topic: c.topic ?? "general",
      readOnly: c.readOnly ?? false,
      input: zodToJsonSchema(c.input),
    })),
    api: {
      baseUrl: def.api?.baseUrl ?? null,
      // Tier-2 generic invoker is available only when the connector ships a
      // raw-request executor.
      canCall: Boolean(def.api?.request),
      operations: def.api?.operations ?? [],
    },
  };
}

const server = createServer(async (req, res) => {
  // Permissive CORS for the local Vite dev server.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") return send(res, 204);

  const method = req.method ?? "GET";
  const path = new URL(req.url ?? "/", "http://localhost").pathname;

  try {
    if (path === "/health") {
      return send(res, 200, { ok: true, workspace: WORKSPACE });
    }
    if (path === "/connectors/catalog" && method === "GET") {
      return send(res, 200, catalog());
    }

    if (path === "/projects") {
      if (method === "GET") return send(res, 200, await projects.list());
      if (method === "POST") {
        const body = await readBody<CreateProjectData>(req);
        return send(res, 201, await projects.create(body));
      }
    }

    let m: RegExpMatchArray | null;
    if ((m = path.match(/^\/projects\/([^/]+)$/))) {
      const id = m[1]!;
      if (method === "GET") {
        const p = await projects.findById(id);
        return p
          ? send(res, 200, p)
          : send(res, 404, { error: "Project not found" });
      }
      if (method === "PATCH") {
        const body = await readBody<UpdateProjectData>(req);
        return send(res, 200, await projects.update(id, body));
      }
      if (method === "DELETE") {
        await projects.delete(id);
        return send(res, 204);
      }
    }

    if ((m = path.match(/^\/projects\/([^/]+)\/connectors$/))) {
      const projectId = m[1]!;
      if (method === "GET") {
        return send(res, 200, await connectors.findByProject(projectId));
      }
      if (method === "POST") {
        const body = await readBody<RegisterConnectorInput>(req);
        return send(res, 201, await connectorService.register(projectId, body));
      }
    }

    if (
      (m = path.match(/^\/connectors\/catalog\/([^/]+)\/schema$/)) &&
      method === "GET"
    ) {
      const schema = connectorSchema(m[1]!);
      return schema
        ? send(res, 200, schema)
        : send(res, 404, { error: "Unknown connector type" });
    }

    if ((m = path.match(/^\/connectors\/([^/]+)\/connect$/)) && method === "POST") {
      const body = await readBody<Record<string, unknown>>(req);
      return send(res, 200, await connectorService.connect(m[1]!, body));
    }
    if (
      (m = path.match(/^\/connectors\/([^/]+)\/disconnect$/)) &&
      method === "POST"
    ) {
      return send(res, 200, await connectorService.disconnect(m[1]!));
    }
    if (
      (m = path.match(/^\/connectors\/([^/]+)\/capabilities\/([^/]+)$/)) &&
      method === "POST"
    ) {
      const body = await readBody<unknown>(req);
      return send(res, 200, await connectorService.invoke(m[1]!, m[2]!, body));
    }
    if ((m = path.match(/^\/connectors\/([^/]+)\/api$/)) && method === "POST") {
      const body = await readBody<CallApiInput>(req);
      return send(res, 200, await connectorService.callApi(m[1]!, body));
    }
    if ((m = path.match(/^\/connectors\/([^/]+)\/chat$/)) && method === "POST") {
      const body = await readBody<ModelChatInput>(req);
      return send(res, 200, await connectorService.chat(m[1]!, body));
    }
    if (
      (m = path.match(/^\/connectors\/([^/]+)\/chat\/agentic$/)) &&
      method === "POST"
    ) {
      const body = await readBody<ModelChatInput>(req);
      return send(res, 200, await connectorService.chatWithTools(m[1]!, body));
    }
    if (
      (m = path.match(/^\/connectors\/([^/]+)\/chat\/turn$/)) &&
      method === "POST"
    ) {
      const body = await readBody<ModelChatInput>(req);
      return send(res, 200, await connectorService.chatTurn(m[1]!, body));
    }
    if (
      (m = path.match(/^\/connectors\/([^/]+)\/chat\/turn\/stream$/)) &&
      method === "POST"
    ) {
      const body = await readBody<ModelChatInput>(req);
      const gen = connectorService.chatTurnStream(m[1]!, body);
      // NDJSON event stream: {type:"text"|"tools"|"error", value}.
      let first: IteratorResult<string, { toolCalls: unknown[] }>;
      try {
        first = await gen.next();
      } catch (err) {
        return fail(res, err);
      }
      res.writeHead(200, { "content-type": "application/x-ndjson" });
      try {
        let cur = first;
        while (!cur.done) {
          res.write(JSON.stringify({ type: "text", value: cur.value }) + "\n");
          cur = await gen.next();
        }
        res.write(
          JSON.stringify({ type: "tools", value: cur.value.toolCalls }) + "\n",
        );
      } catch (err) {
        res.write(
          JSON.stringify({ type: "error", value: (err as Error).message }) +
            "\n",
        );
      }
      return res.end();
    }
    if (
      (m = path.match(/^\/connectors\/([^/]+)\/run-tool$/)) &&
      method === "POST"
    ) {
      const body = await readBody<{ name: string; input: unknown }>(req);
      return send(
        res,
        200,
        await connectorService.runTool(m[1]!, body.name, body.input),
      );
    }
    if (
      (m = path.match(/^\/connectors\/([^/]+)\/chat\/stream$/)) &&
      method === "POST"
    ) {
      const body = await readBody<ModelChatInput>(req);
      const iterator = connectorService.chatStream(m[1]!, body);
      // Pull the first chunk before committing the status, so setup errors
      // (bad instance / not a model / connection) still return a clean 400.
      let first: IteratorResult<string>;
      try {
        first = await iterator.next();
      } catch (err) {
        return fail(res, err);
      }
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      try {
        if (!first.done) res.write(first.value);
        for await (const delta of iterator) res.write(delta);
      } catch (err) {
        res.write(`\n[stream error] ${(err as Error).message}`);
      }
      return res.end();
    }
    if ((m = path.match(/^\/projects\/([^/]+)\/conversations$/))) {
      const projectId = m[1]!;
      if (method === "GET") {
        return send(res, 200, await conversations.listByProject(projectId));
      }
      if (method === "POST") {
        const body = await readBody<Omit<CreateConversationData, "projectId">>(
          req,
        );
        return send(
          res,
          201,
          await conversations.create({ ...body, projectId }),
        );
      }
    }
    if ((m = path.match(/^\/conversations\/([^/]+)$/))) {
      const id = m[1]!;
      if (method === "GET") {
        const c = await conversations.get(id);
        return c
          ? send(res, 200, c)
          : send(res, 404, { error: "Conversation not found" });
      }
      if (method === "PATCH") {
        const body = await readBody<UpdateConversationData>(req);
        return send(res, 200, await conversations.update(id, body));
      }
      if (method === "DELETE") {
        await conversations.delete(id);
        return send(res, 204);
      }
    }
    if ((m = path.match(/^\/connectors\/([^/]+)\/saved-requests$/))) {
      const instanceId = m[1]!;
      if (method === "GET") {
        return send(res, 200, await savedRequests.listByInstance(instanceId));
      }
      if (method === "POST") {
        const body = await readBody<Omit<CreateSavedRequestData, "instanceId">>(
          req,
        );
        return send(
          res,
          201,
          await savedRequests.create({ ...body, instanceId }),
        );
      }
    }
    if ((m = path.match(/^\/saved-requests\/([^/]+)$/)) && method === "DELETE") {
      await savedRequests.delete(m[1]!);
      return send(res, 204);
    }
    if (
      (m = path.match(/^\/connectors\/([^/]+)\/mcp-config$/)) &&
      method === "GET"
    ) {
      const instance = await connectors.findById(m[1]!);
      if (!instance) return send(res, 404, { error: "instance not found" });
      // Packaged app sets ORBIT_MCP_BIN to the bundled binary; in dev we point
      // at the esbuild bundle next to the sidecar.
      const bin = process.env.ORBIT_MCP_BIN;
      const command = bin ?? process.execPath;
      const entry = join(__dirname, "..", "dist-mcp", "orbit-mcp.mjs");
      const args = bin
        ? ["--instance", instance.id]
        : [entry, "--instance", instance.id];
      return send(res, 200, {
        key: `orbit-${instance.connectorType}-${instance.id.slice(0, 6)}`,
        command,
        args,
        env: { ORBIT_WORKSPACE: WORKSPACE, ORBIT_HOME },
      });
    }

    if ((m = path.match(/^\/connectors\/([^/]+)$/))) {
      const id = m[1]!;
      if (method === "PATCH") {
        const body = await readBody<UpdateConnectorInput>(req);
        return send(res, 200, await connectorService.update(id, body));
      }
      if (method === "DELETE") {
        await connectorService.remove(id);
        return send(res, 204);
      }
    }

    send(res, 404, { error: `No route: ${method} ${path}` });
  } catch (err) {
    fail(res, err);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(
    `Orbit desktop sidecar → http://127.0.0.1:${PORT}  (workspace: ${WORKSPACE})`,
  );
});
