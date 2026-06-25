import { ConnectorRegistry } from "@orbit/connector-sdk";
import { githubConnector } from "@orbit/connector-github";
import { keycloakConnector } from "@orbit/connector-keycloak";

/**
 * The default set of code-backed connectors available in any Orbit host
 * (server or desktop). Hosts depend on this factory rather than wiring the
 * individual `@orbit/connector-*` packages themselves, so the catalogue stays
 * identical everywhere. The host never touches connector internals — only the
 * `ConnectorDefinition` contract from `@orbit/connector-sdk`.
 */
export function createDefaultRegistry(): ConnectorRegistry {
  const registry = new ConnectorRegistry();
  registry.register(githubConnector);
  registry.register(keycloakConnector);
  return registry;
}
