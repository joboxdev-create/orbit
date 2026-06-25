import { Module } from "@nestjs/common";
import { createDefaultRegistry } from "@orbit/engine";
import { ConnectorsController } from "./connectors.controller";
import { ConnectorInstancesController } from "./connector-instances.controller";
import { ConnectorInstancesService } from "./connector-instances.service";
import { PrismaConnectorInstanceRepository } from "./prisma-connector-instance.repository";
import { CONNECTOR_REGISTRY } from "./connectors.tokens";

@Module({
  controllers: [ConnectorsController, ConnectorInstancesController],
  providers: [
    ConnectorInstancesService,
    PrismaConnectorInstanceRepository,
    {
      // The default connector catalogue comes from the shared engine, so the
      // server and the future desktop host expose the same connectors.
      provide: CONNECTOR_REGISTRY,
      useFactory: () => createDefaultRegistry(),
    },
  ],
  exports: [CONNECTOR_REGISTRY],
})
export class ConnectorsModule {}
