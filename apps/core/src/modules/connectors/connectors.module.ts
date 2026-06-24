import { Module } from "@nestjs/common";
import { ConnectorRegistry } from "@orbit/connector-sdk";
import { githubConnector } from "@orbit/connector-github";
import { keycloakConnector } from "@orbit/connector-keycloak";
import { ConnectorsController } from "./connectors.controller";
import { ConnectorInstancesController } from "./connector-instances.controller";
import { ConnectorInstancesService } from "./connector-instances.service";
import { CONNECTOR_REGISTRY } from "./connectors.tokens";

@Module({
  controllers: [ConnectorsController, ConnectorInstancesController],
  providers: [
    ConnectorInstancesService,
    {
      provide: CONNECTOR_REGISTRY,
      useFactory: (): ConnectorRegistry => {
        const registry = new ConnectorRegistry();
        // Installed @orbit/connector-* packages are registered here. The core
        // only depends on the ConnectorDefinition contract, not on their internals.
        registry.register(githubConnector);
        registry.register(keycloakConnector);
        return registry;
      },
    },
  ],
  exports: [CONNECTOR_REGISTRY],
})
export class ConnectorsModule {}
