// Orbit desktop sidecar: the engine's local host. It runs the same @orbit/engine
// domain logic as the server, but over the *filesystem* store (no DB), and
// exposes it as a tiny HTTP API on 127.0.0.1 for the Tauri webview / Vite dev
// server to call. Single-user, local-first: no auth, no organizations.
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  ConnectorInstanceService,
  createDefaultRegistry,
  type CreateProjectData,
  EngineError,
  FsConnectorInstanceRepository,
  FsProjectRepository,
  type RegisterConnectorInput,
  type UpdateConnectorInput,
  type UpdateProjectData,
} from "@orbit/engine";

const WORKSPACE =
  process.env.ORBIT_WORKSPACE ?? join(homedir(), ".orbit-workspace");
const PORT = Number(process.env.PORT ?? 4317);

const registry = createDefaultRegistry();
const projects = new FsProjectRepository(WORKSPACE);
const connectors = new FsConnectorInstanceRepository(WORKSPACE);
const connectorService = new ConnectorInstanceService({
  repo: connectors,
  registry,
});

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
