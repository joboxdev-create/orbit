import type { LayerKind } from "@orbit/shared";
import type { ConnectorDefinition } from "./types.js";

/**
 * In-memory registry of connector definitions. The core builds one of these
 * at startup by registering every installed @orbit/connector-* package, then
 * resolves instances against it. Keeps the core decoupled from concrete
 * integrations: it only ever sees the ConnectorDefinition contract.
 */
export class ConnectorRegistry {
  private readonly byType = new Map<string, ConnectorDefinition>();

  /**
   * Register a connector. Accepts a strongly-typed definition and erases it to
   * the base contract for storage — connectors are authored with concrete
   * Config/Credentials types, the core only ever sees the erased contract.
   */
  register<Config, Credentials>(
    def: ConnectorDefinition<Config, Credentials>,
  ): void {
    if (this.byType.has(def.type)) {
      throw new Error(`Connector type already registered: ${def.type}`);
    }
    this.byType.set(def.type, def as unknown as ConnectorDefinition);
  }

  get(type: string): ConnectorDefinition | undefined {
    return this.byType.get(type);
  }

  require(type: string): ConnectorDefinition {
    const def = this.get(type);
    if (!def) throw new Error(`Unknown connector type: ${type}`);
    return def;
  }

  list(): ConnectorDefinition[] {
    return [...this.byType.values()];
  }

  listByLayer(layer: LayerKind): ConnectorDefinition[] {
    return this.list().filter((d) => d.layer === layer);
  }
}
