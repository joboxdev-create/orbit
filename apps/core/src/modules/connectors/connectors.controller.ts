import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
} from "@nestjs/common";
import {
  ConnectorRegistry,
  mcpToolsFromConnector,
} from "@orbit/connector-sdk";
import { Public } from "../auth/decorators";
import { CONNECTOR_REGISTRY } from "./connectors.tokens";

// Connector *catalog* (available types + their MCP tools) is non-sensitive
// metadata, not tenant data — expose it without authentication.
@Public()
@Controller("connectors")
export class ConnectorsController {
  constructor(
    @Inject(CONNECTOR_REGISTRY)
    private readonly registry: ConnectorRegistry,
  ) {}

  /** List every available connector type, grouped-friendly for the UI. */
  @Get()
  list() {
    return this.registry.list().map((def) => ({
      type: def.type,
      layer: def.layer,
      displayName: def.displayName,
      description: def.description,
      icon: def.icon ?? null,
      capabilities: def.capabilities.length,
      apiOperations: def.api?.operations.length ?? 0,
    }));
  }

  /** MCP tool definitions for a connector type (map once -> MCP + API). */
  @Get(":type/tools")
  tools(@Param("type") type: string) {
    const def = this.registry.get(type);
    if (!def) {
      throw new NotFoundException(`Unknown connector type: ${type}`);
    }
    return mcpToolsFromConnector(def);
  }
}
