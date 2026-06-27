import type { McpTransport } from "@/lib/api";

/**
 * A curated, well-known MCP server the user can start from in the Add dialog.
 * This is a convenience catalogue (auto-discovery, step 2): it only seeds the
 * form — non-secret defaults here, secret inputs declared in `secretKeys` and
 * rendered as empty rows so they go to the SecretStore, never the catalogue.
 * Args/paths are editable: e.g. filesystem needs a real directory.
 */
export interface McpPreset {
  id: string;
  /** Catalogue label. */
  label: string;
  /** Default server name once added. */
  name: string;
  description: string;
  category: "Reference" | "Search" | "Dev" | "Web";
  transport: McpTransport;
  command?: string;
  args?: string[];
  url?: string;
  /** Non-secret env/header defaults. */
  env?: Record<string, string>;
  /** Secret env/header names — rendered as empty, secret rows. */
  secretKeys?: string[];
  docsUrl?: string;
}

const SERVERS_REPO =
  "https://github.com/modelcontextprotocol/servers/tree/main/src";

/**
 * Hand-picked official/reference MCP servers. Kept short on purpose — the list
 * is a starting point, not a registry. Most are `npx -y` stdio processes.
 */
export const MCP_PRESETS: McpPreset[] = [
  {
    id: "filesystem",
    label: "Filesystem",
    name: "Filesystem",
    description:
      "Read/write access to a directory on this machine. Edit the path argument.",
    category: "Reference",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"],
    docsUrl: `${SERVERS_REPO}/filesystem`,
  },
  {
    id: "memory",
    label: "Memory (knowledge graph)",
    name: "Memory",
    description: "A persistent knowledge-graph memory the model can read/write.",
    category: "Reference",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    docsUrl: `${SERVERS_REPO}/memory`,
  },
  {
    id: "sequential-thinking",
    label: "Sequential Thinking",
    name: "Sequential Thinking",
    description:
      "A structured step-by-step reasoning tool for breaking down problems.",
    category: "Reference",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
    docsUrl: `${SERVERS_REPO}/sequentialthinking`,
  },
  {
    id: "everything",
    label: "Everything (reference/test)",
    name: "Everything",
    description:
      "Reference server exercising every MCP feature — useful to test the wiring.",
    category: "Reference",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-everything"],
    docsUrl: `${SERVERS_REPO}/everything`,
  },
];
