import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { type ConnectorContext, ConnectorRegistry } from "@orbit/connector-sdk";
import type { ZodType } from "zod";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { CryptoService } from "../../shared/crypto/crypto.service";
import { AccessControlService } from "../../shared/authz/access-control.service";
import { CONNECTOR_REGISTRY } from "./connectors.tokens";

export interface CreateInstanceInput {
  connectorType: string;
  name: string;
  config: Record<string, unknown>;
  credentials: Record<string, unknown>;
}

export interface RegisterInstanceInput {
  /** "catalog" = a code-backed connector from the registry; "custom" = a
   *  user-declared service that has no live integration yet. */
  source: "catalog" | "custom";
  name: string;
  /** Required when source is "catalog": the registry connector type id. */
  connectorType?: string;
  /** Required when source is "custom": the chosen layer category. */
  layer?: string;
  config: Record<string, unknown>;
}

export interface UpdateInstanceInput {
  name?: string;
  /** Only applied to custom instances (catalog ones derive layer from the def). */
  layer?: string;
  config?: Record<string, unknown>;
}

/** Sentinel connectorType for user-declared services without a code connector. */
export const CUSTOM_CONNECTOR_TYPE = "custom";

// Never return the encrypted blob to clients.
const PUBLIC_FIELDS = {
  id: true,
  projectId: true,
  connectorType: true,
  layer: true,
  name: true,
  status: true,
  config: true,
  createdAt: true,
} satisfies Prisma.ConnectorInstanceSelect;

@Injectable()
export class ConnectorInstancesService {
  private readonly logger = new Logger(ConnectorInstancesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly acl: AccessControlService,
    @Inject(CONNECTOR_REGISTRY)
    private readonly registry: ConnectorRegistry,
  ) {}

  async create(userId: string, projectId: string, input: CreateInstanceInput) {
    const project = await this.requireProject(projectId);
    await this.acl.assertMember(userId, project.orgId, "member");

    const def = this.registry.get(input.connectorType);
    if (!def) {
      throw new BadRequestException(
        `Unknown connector type: ${input.connectorType}`,
      );
    }

    const config = this.parseOrThrow<Record<string, unknown>>(
      def.configSchema,
      input.config,
      "config",
    );
    const credentials = this.parseOrThrow<Record<string, unknown>>(
      def.credentialsSchema,
      input.credentials,
      "credentials",
    );

    // Validate the connection works before persisting anything.
    try {
      await def.testConnection(this.buildContext(config, credentials));
    } catch (err) {
      throw new BadRequestException(
        `Connection test failed: ${(err as Error).message}`,
      );
    }

    return this.prisma.connectorInstance.create({
      data: {
        projectId,
        connectorType: def.type,
        layer: def.layer,
        name: input.name,
        status: "connected",
        config: config as Prisma.InputJsonValue,
        encryptedCredentials: this.crypto.encryptJson(credentials),
      },
      select: PUBLIC_FIELDS,
    });
  }

  /**
   * Register a connector in a project without configuring credentials. This is
   * the "catalogue it" step (status "configured"); wiring credentials, running
   * testConnection and invoking capabilities is a separate, later step. Supports
   * both catalog connectors (code-backed) and custom user-declared services.
   */
  async register(
    userId: string,
    projectId: string,
    input: RegisterInstanceInput,
  ) {
    const project = await this.requireProject(projectId);
    await this.acl.assertMember(userId, project.orgId, "member");

    let connectorType: string;
    let layer: string;

    if (input.source === "catalog") {
      if (!input.connectorType) {
        throw new BadRequestException("connectorType is required for catalog connectors");
      }
      const def = this.registry.get(input.connectorType);
      if (!def) {
        throw new BadRequestException(
          `Unknown connector type: ${input.connectorType}`,
        );
      }
      connectorType = def.type;
      layer = def.layer;
    } else {
      if (!input.layer) {
        throw new BadRequestException("layer is required for custom connectors");
      }
      connectorType = CUSTOM_CONNECTOR_TYPE;
      layer = input.layer;
    }

    return this.prisma.connectorInstance.create({
      data: {
        projectId,
        connectorType,
        layer,
        name: input.name,
        status: "configured",
        config: input.config as Prisma.InputJsonValue,
      },
      select: PUBLIC_FIELDS,
    });
  }

  async list(userId: string, projectId: string) {
    const project = await this.requireProject(projectId);
    await this.acl.assertMember(userId, project.orgId);
    return this.prisma.connectorInstance.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: PUBLIC_FIELDS,
    });
  }

  async update(
    userId: string,
    instanceId: string,
    input: UpdateInstanceInput,
  ) {
    const instance = await this.requireInstance(instanceId);
    await this.acl.assertMember(userId, instance.project.orgId, "member");

    const data: Prisma.ConnectorInstanceUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.config !== undefined) {
      data.config = input.config as Prisma.InputJsonValue;
    }
    // The layer of a catalog connector is fixed by its definition; only custom
    // (user-declared) instances may change layer.
    if (
      input.layer !== undefined &&
      instance.connectorType === CUSTOM_CONNECTOR_TYPE
    ) {
      data.layer = input.layer;
    }

    return this.prisma.connectorInstance.update({
      where: { id: instanceId },
      data,
      select: PUBLIC_FIELDS,
    });
  }

  async remove(userId: string, instanceId: string): Promise<void> {
    const instance = await this.requireInstance(instanceId);
    await this.acl.assertMember(userId, instance.project.orgId, "member");
    await this.prisma.connectorInstance.delete({ where: { id: instanceId } });
  }

  /** Invoke a connector capability directly — the no-AI execution path. */
  async invoke(
    userId: string,
    instanceId: string,
    capabilityName: string,
    rawInput: unknown,
  ) {
    const instance = await this.prisma.connectorInstance.findUnique({
      where: { id: instanceId },
      include: { project: { select: { orgId: true } } },
    });
    if (!instance) {
      throw new NotFoundException(`Connector instance not found: ${instanceId}`);
    }

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

    // Read-only capabilities need only viewer; mutating ones need member.
    await this.acl.assertMember(
      userId,
      instance.project.orgId,
      capability.readOnly ? "viewer" : "member",
    );

    const input = this.parseOrThrow(capability.input, rawInput, "input");
    const credentials = instance.encryptedCredentials
      ? this.crypto.decryptJson<Record<string, unknown>>(
          instance.encryptedCredentials,
        )
      : {};
    const config = (instance.config ?? {}) as Record<string, unknown>;

    const result = await capability.handler(
      this.buildContext(config, credentials),
      input,
    );
    return { capability: capability.name, result };
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

  private parseOrThrow<T>(schema: ZodType, value: unknown, label: string): T {
    const result = schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: `Invalid ${label}`,
        issues: result.error.flatten(),
      });
    }
    return result.data as T;
  }

  private buildContext(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
  ): ConnectorContext {
    return {
      config,
      credentials,
      fetch: globalThis.fetch,
      logger: {
        debug: (m, meta) => this.logger.debug(m, meta),
        info: (m, meta) => this.logger.log(m, meta),
        warn: (m, meta) => this.logger.warn(m, meta),
        error: (m, meta) => this.logger.error(m, meta),
      },
    };
  }
}
