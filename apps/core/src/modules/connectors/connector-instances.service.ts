import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConnectorRegistry } from "@orbit/connector-sdk";
import {
  type CallApiInput,
  ConnectorInstanceService as EngineConnectorInstanceService,
  type ConnectorInstanceRecord,
  EngineError,
} from "@orbit/engine";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { AccessControlService } from "../../shared/authz/access-control.service";
import { CONNECTOR_REGISTRY } from "./connectors.tokens";
import { PrismaConnectorInstanceRepository } from "./prisma-connector-instance.repository";
import { PrismaSecretStore } from "./prisma-secret-store";

export interface CreateInstanceInput {
  connectorType: string;
  name: string;
  config: Record<string, unknown>;
  credentials: Record<string, unknown>;
}

export interface RegisterInstanceInput {
  source: "catalog" | "custom";
  name: string;
  connectorType?: string;
  layer?: string;
  config: Record<string, unknown>;
}

export interface UpdateInstanceInput {
  name?: string;
  layer?: string;
  config?: Record<string, unknown>;
}

/**
 * Server adapter over the engine's connector-instance domain logic. This class
 * owns only the server concerns — **governance** (RBAC via AccessControlService)
 * and **transport** (mapping engine errors to HTTP). All domain logic — register,
 * list, update, remove, **connect/disconnect/invoke** — lives in
 * {@link EngineConnectorInstanceService}, so the server and the desktop host
 * share one credentialed flow; only the {@link SecretStore} adapter differs
 * (Postgres here, keychain/file on the desktop).
 */
@Injectable()
export class ConnectorInstancesService {
  private readonly logger = new Logger(ConnectorInstancesService.name);
  private readonly instances: EngineConnectorInstanceService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly acl: AccessControlService,
    @Inject(CONNECTOR_REGISTRY)
    private readonly registry: ConnectorRegistry,
    repo: PrismaConnectorInstanceRepository,
    secrets: PrismaSecretStore,
  ) {
    this.instances = new EngineConnectorInstanceService({
      repo,
      registry: this.registry,
      secrets,
      fetch: globalThis.fetch,
      logger: {
        debug: (m, meta) => this.logger.debug(m, meta),
        info: (m, meta) => this.logger.log(m, meta),
        warn: (m, meta) => this.logger.warn(m, meta),
        error: (m, meta) => this.logger.error(m, meta),
      },
    });
  }

  /**
   * One-shot configure & connect: register a catalog instance, then connect it.
   * If the connection test fails, the just-registered instance is rolled back so
   * the call stays atomic from the client's point of view.
   */
  async create(userId: string, projectId: string, input: CreateInstanceInput) {
    const project = await this.requireProject(projectId);
    await this.acl.assertMember(userId, project.orgId, "member");

    const record = await this.guard(async () => {
      const registered = await this.instances.register(projectId, {
        source: "catalog",
        name: input.name,
        connectorType: input.connectorType,
        config: input.config,
      });
      try {
        return await this.instances.connect(registered.id, input.credentials);
      } catch (err) {
        await this.instances.remove(registered.id).catch(() => {});
        throw err;
      }
    });
    return toPublic(record);
  }

  /** Configure & connect an already-registered instance (validate + testConnection). */
  async connect(userId: string, instanceId: string, rawCredentials: unknown) {
    const instance = await this.requireInstance(instanceId);
    await this.acl.assertMember(userId, instance.project.orgId, "member");
    const record = await this.guard(() =>
      this.instances.connect(instanceId, rawCredentials),
    );
    return toPublic(record);
  }

  /** Drop stored credentials and return the instance to `configured`. */
  async disconnect(userId: string, instanceId: string) {
    const instance = await this.requireInstance(instanceId);
    await this.acl.assertMember(userId, instance.project.orgId, "member");
    const record = await this.guard(() =>
      this.instances.disconnect(instanceId),
    );
    return toPublic(record);
  }

  async register(
    userId: string,
    projectId: string,
    input: RegisterInstanceInput,
  ) {
    const project = await this.requireProject(projectId);
    await this.acl.assertMember(userId, project.orgId, "member");
    const record = await this.guard(() =>
      this.instances.register(projectId, input),
    );
    return toPublic(record);
  }

  async list(userId: string, projectId: string) {
    const project = await this.requireProject(projectId);
    await this.acl.assertMember(userId, project.orgId);
    const records = await this.instances.listByProject(projectId);
    return records.map(toPublic);
  }

  async update(userId: string, instanceId: string, input: UpdateInstanceInput) {
    const instance = await this.requireInstance(instanceId);
    await this.acl.assertMember(userId, instance.project.orgId, "member");
    const record = await this.guard(() =>
      this.instances.update(instanceId, input),
    );
    return toPublic(record);
  }

  async remove(userId: string, instanceId: string): Promise<void> {
    const instance = await this.requireInstance(instanceId);
    await this.acl.assertMember(userId, instance.project.orgId, "member");
    await this.guard(() => this.instances.remove(instanceId));
  }

  /** Invoke a connector capability directly — the no-AI execution path. */
  async invoke(
    userId: string,
    instanceId: string,
    capabilityName: string,
    rawInput: unknown,
  ) {
    const instance = await this.requireInstance(instanceId);

    const def = this.registry.get(instance.connectorType);
    if (!def) {
      throw new BadRequestException(
        `Connector type no longer available: ${instance.connectorType}`,
      );
    }

    const capability = def.capabilities.find((c) => c.name === capabilityName);
    if (!capability) {
      throw new NotFoundException(
        `Unknown capability "${capabilityName}" for ${def.type}`,
      );
    }

    // RBAC: mutating capabilities require `member`, read-only only `viewer`.
    await this.acl.assertMember(
      userId,
      instance.project.orgId,
      capability.readOnly ? "viewer" : "member",
    );

    return this.guard(() =>
      this.instances.invoke(instanceId, capabilityName, rawInput),
    );
  }

  /** Generic (Tier-2) raw API call — the no-AI "call any operation" path. */
  async callApi(userId: string, instanceId: string, input: CallApiInput) {
    const instance = await this.requireInstance(instanceId);

    // Resolve the HTTP verb for RBAC: a catalogued operation carries its own
    // method; a raw call uses the given one. Anything but GET may mutate.
    const def = this.registry.get(instance.connectorType);
    let method = input.method;
    if (input.operationId) {
      const op = def?.api?.operations.find((o) => o.id === input.operationId);
      method = op?.method ?? method;
    }
    await this.acl.assertMember(
      userId,
      instance.project.orgId,
      method === "GET" ? "viewer" : "member",
    );

    return this.guard(() => this.instances.callApi(instanceId, input));
  }

  private async requireProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException(`Project not found: ${projectId}`);
    }
    return project;
  }

  private async requireInstance(instanceId: string) {
    const instance = await this.prisma.connectorInstance.findUnique({
      where: { id: instanceId },
      include: { project: { select: { orgId: true } } },
    });
    if (!instance) {
      throw new NotFoundException(`Connector instance not found: ${instanceId}`);
    }
    return instance;
  }

  /** Run an engine call, mapping its framework-free errors to HTTP exceptions. */
  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof EngineError) {
        switch (err.kind) {
          case "not_found":
            throw new NotFoundException(err.message);
          case "conflict":
            throw new ConflictException(err.message);
          case "forbidden":
            throw new ForbiddenException(err.message);
          default:
            throw new BadRequestException(err.message);
        }
      }
      throw err;
    }
  }
}

function toPublic(record: ConnectorInstanceRecord) {
  const { encryptedCredentials: _omit, ...publicFields } = record;
  return publicFields;
}
