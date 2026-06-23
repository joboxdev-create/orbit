import { zodToJsonSchema } from "zod-to-json-schema";
import type { ConnectorDefinition } from "./types.js";

/** Minimal MCP tool shape (name + description + JSON Schema input). */
export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Hints the core uses for permission/agent policy. */
  annotations: {
    connectorType: string;
    topic: string;
    readOnly: boolean;
  };
}

/**
 * Project a connector's capabilities into MCP tool definitions. This is the
 * "map once -> use as MCP tool" half; the same Capability objects are also
 * invoked directly by the UI for the no-AI path. Tool names are namespaced
 * by connector type to stay unique across a project's connectors.
 */
export function mcpToolsFromConnector(
  def: ConnectorDefinition,
): McpToolDefinition[] {
  return def.capabilities
    .filter((c) => c.exposeAsTool !== false)
    .map((c) => ({
      name: `${def.type}__${c.name}`,
      description: c.description,
      inputSchema: zodToJsonSchema(c.input, { target: "openApi3" }) as Record<
        string,
        unknown
      >,
      annotations: {
        connectorType: def.type,
        topic: c.topic,
        readOnly: c.readOnly,
      },
    }));
}
