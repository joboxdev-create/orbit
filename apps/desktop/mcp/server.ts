// orbit-mcp — Orbit exposed as an MCP *server*, dedicated to ONE connected
// instance (one tool, e.g. a specific GitHub connection). An external agent
// (Claude Desktop, Cursor, …) connects over stdio and sees that connector's
// capabilities as MCP tools; tools/call runs them through the engine, reusing
// the instance's stored credentials. No LLM here — the brain is the client's.
//
//   node orbit-mcp.cjs --instance <connectorInstanceId>
//   env: ORBIT_WORKSPACE (projects on disk), ORBIT_HOME (secrets + key)

import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { mcpToolsFromConnector } from "@orbit/connector-sdk";
import {
  ConnectorInstanceService,
  createDefaultRegistry,
  FsConnectorInstanceRepository,
} from "@orbit/engine";
import { FileSecretStore } from "../sidecar/fs-secret-store.js";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Load the local master key, generating one on first run (mirrors the sidecar). */
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

function die(message: string): never {
  process.stderr.write(`orbit-mcp: ${message}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const instanceId = argValue("--instance");
  if (!instanceId) die("missing --instance <connectorInstanceId>");

  const WORKSPACE =
    process.env.ORBIT_WORKSPACE ?? join(homedir(), ".orbit-workspace");
  const ORBIT_HOME = process.env.ORBIT_HOME ?? join(homedir(), ".orbit");

  const registry = createDefaultRegistry();
  const connectors = new FsConnectorInstanceRepository(WORKSPACE);
  const secrets = new FileSecretStore(
    join(ORBIT_HOME, "secrets.json"),
    loadOrCreateKey(join(ORBIT_HOME, "secret.key")),
  );
  const service = new ConnectorInstanceService({
    repo: connectors,
    registry,
    secrets,
    fetch: globalThis.fetch,
  });

  const instance = await connectors.findById(instanceId);
  if (!instance) die(`connector instance not found: ${instanceId}`);
  const def = registry.get(instance.connectorType);
  if (!def) die(`no live connector for type: ${instance.connectorType}`);

  // Project the connector's capabilities into MCP tools, and keep a map back to
  // the capability name for tools/call.
  const tools = mcpToolsFromConnector(def);
  const toolToCapability = new Map<string, string>();
  for (const c of def.capabilities) {
    if (c.exposeAsTool !== false) {
      toolToCapability.set(`${def.type}__${c.name}`, c.name);
    }
  }

  const server = new Server(
    { name: `orbit-${def.type}`, version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as { type: "object" },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const capability = toolToCapability.get(name);
    if (!capability) {
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }
    try {
      const { result } = await service.invoke(instanceId, capability, args ?? {});
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: (err as Error).message }],
        isError: true,
      };
    }
  });

  await server.connect(new StdioServerTransport());
  // Stays alive on stdio until the client disconnects.
}

main().catch((err) => die((err as Error).stack ?? String(err)));
