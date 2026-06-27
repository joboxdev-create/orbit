import { readFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { join } from "node:path";

/**
 * Read-only discovery of MCP servers already configured in other clients on
 * this machine (Claude Desktop, Cursor, Windsurf). It only *reads* their config
 * files and reports what it finds — Orbit never auto-connects or persists any of
 * it. The user imports a detected server explicitly (assigning it to a connector
 * and choosing which env/headers are secret) — "Orbit connette, non contiene".
 */
export type DiscoveredTransport = "stdio" | "http" | "sse";

export interface DiscoveredMcpServer {
  /** Which client config it came from, e.g. "Claude Desktop". */
  source: string;
  sourcePath: string;
  name: string;
  transport: DiscoveredTransport;
  command?: string;
  args?: string[];
  url?: string;
  /** Raw env (stdio) / headers (remote) as found — values shown so the user can
   *  review and flag the secret ones on import; never persisted by discovery. */
  env?: Record<string, string>;
  headers?: Record<string, string>;
}

function isRecord(v: unknown): v is Record<string, string> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Per-OS config file locations for the clients that share the `mcpServers` shape. */
function configSources(): { source: string; path: string }[] {
  const home = homedir();
  const os = platform();
  const out: { source: string; path: string }[] = [];

  // Claude Desktop
  if (os === "darwin")
    out.push({
      source: "Claude Desktop",
      path: join(
        home,
        "Library/Application Support/Claude/claude_desktop_config.json",
      ),
    });
  else if (os === "win32" && process.env.APPDATA)
    out.push({
      source: "Claude Desktop",
      path: join(process.env.APPDATA, "Claude/claude_desktop_config.json"),
    });
  else
    out.push({
      source: "Claude Desktop",
      path: join(home, ".config/Claude/claude_desktop_config.json"),
    });

  // Cursor (global) and Windsurf use the same JSON shape.
  out.push({ source: "Cursor", path: join(home, ".cursor/mcp.json") });
  out.push({
    source: "Windsurf",
    path: join(home, ".codeium/windsurf/mcp_config.json"),
  });

  return out;
}

function toServers(
  source: string,
  sourcePath: string,
  json: unknown,
): DiscoveredMcpServer[] {
  const root = (json ?? {}) as Record<string, unknown>;
  const map = (root.mcpServers ?? root.servers ?? {}) as Record<string, unknown>;
  const out: DiscoveredMcpServer[] = [];
  for (const [name, rawValue] of Object.entries(map)) {
    if (!isRecord(rawValue) && typeof rawValue !== "object") continue;
    const raw = rawValue as Record<string, unknown>;
    if (typeof raw.command === "string") {
      out.push({
        source,
        sourcePath,
        name,
        transport: "stdio",
        command: raw.command,
        args: Array.isArray(raw.args) ? (raw.args as string[]) : [],
        env: isRecord(raw.env) ? raw.env : undefined,
      });
    } else if (typeof raw.url === "string") {
      const type = String(raw.type ?? "").toLowerCase();
      const transport: DiscoveredTransport = type === "sse" ? "sse" : "http";
      out.push({
        source,
        sourcePath,
        name,
        transport,
        url: raw.url,
        headers: isRecord(raw.headers) ? raw.headers : undefined,
      });
    }
  }
  return out;
}

/** Best-effort scan; missing or malformed files are silently skipped. */
export async function discoverMcpServers(): Promise<DiscoveredMcpServer[]> {
  const out: DiscoveredMcpServer[] = [];
  for (const { source, path } of configSources()) {
    try {
      const text = await readFile(path, "utf8");
      out.push(...toServers(source, path, JSON.parse(text)));
    } catch {
      // not installed / no config / invalid JSON — ignore
    }
  }
  return out;
}
