import type { ConnectorRegistry } from "@orbit/connector-sdk";
import {
  type ConnectorInstanceRecord,
  type ConnectorInstanceRepository,
  CUSTOM_CONNECTOR_TYPE,
  type UpdateConnectorInstanceData,
} from "../domain/connector-instance.js";
import { badRequest, notFound } from "../errors.js";

export interface RegisterConnectorInput {
  /** "catalog" = a code-backed connector from the registry; "custom" = a
   *  user-declared service that has no live integration yet. */
  source: "catalog" | "custom";
  name: string;
  /** Required when source is "catalog". */
  connectorType?: string;
  /** Required when source is "custom". */
  layer?: string;
  config?: Record<string, unknown>;
}

export interface UpdateConnectorInput {
  name?: string;
  layer?: string;
  config?: Record<string, unknown>;
}

export interface ConnectorInstanceServiceDeps {
  repo: ConnectorInstanceRepository;
  registry: ConnectorRegistry;
}

/**
 * Host-neutral domain logic for connector instances. Knows nothing about HTTP,
 * users or RBAC — governance lives in the host above this. The same instance
 * runs over a Prisma store (server) or a filesystem store (desktop) by swapping
 * the {@link ConnectorInstanceRepository}.
 *
 * The credentialed flows (configure & connect, capability invocation) will be
 * added here when that block is built; for now it covers register + CRUD.
 */
export class ConnectorInstanceService {
  constructor(private readonly deps: ConnectorInstanceServiceDeps) {}

  /**
   * Register a connector in a project without credentials (status
   * "configured"). Catalog connectors derive their layer from the registry;
   * custom ones declare it.
   */
  async register(
    projectId: string,
    input: RegisterConnectorInput,
  ): Promise<ConnectorInstanceRecord> {
    let connectorType: string;
    let layer: string;

    if (input.source === "catalog") {
      if (!input.connectorType) {
        throw badRequest("connectorType is required for catalog connectors");
      }
      const def = this.deps.registry.get(input.connectorType);
      if (!def) {
        throw badRequest(`Unknown connector type: ${input.connectorType}`);
      }
      connectorType = def.type;
      layer = def.layer;
    } else {
      if (!input.layer) {
        throw badRequest("layer is required for custom connectors");
      }
      connectorType = CUSTOM_CONNECTOR_TYPE;
      layer = input.layer;
    }

    return this.deps.repo.create({
      projectId,
      connectorType,
      layer,
      name: input.name,
      status: "configured",
      config: input.config ?? {},
    });
  }

  listByProject(projectId: string): Promise<ConnectorInstanceRecord[]> {
    return this.deps.repo.findByProject(projectId);
  }

  getById(instanceId: string): Promise<ConnectorInstanceRecord | null> {
    return this.deps.repo.findById(instanceId);
  }

  async update(
    instanceId: string,
    input: UpdateConnectorInput,
  ): Promise<ConnectorInstanceRecord> {
    const instance = await this.deps.repo.findById(instanceId);
    if (!instance) {
      throw notFound(`Connector instance not found: ${instanceId}`);
    }

    const patch: UpdateConnectorInstanceData = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.config !== undefined) patch.config = input.config;
    // A catalog connector's layer is fixed by its definition; only custom
    // (user-declared) instances may change layer.
    if (
      input.layer !== undefined &&
      instance.connectorType === CUSTOM_CONNECTOR_TYPE
    ) {
      patch.layer = input.layer;
    }

    return this.deps.repo.update(instanceId, patch);
  }

  async remove(instanceId: string): Promise<void> {
    const instance = await this.deps.repo.findById(instanceId);
    if (!instance) {
      throw notFound(`Connector instance not found: ${instanceId}`);
    }
    await this.deps.repo.delete(instanceId);
  }
}
