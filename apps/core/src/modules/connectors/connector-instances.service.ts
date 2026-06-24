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
import { PrismaService } from "../prisma/prisma.service";
import { CryptoService } from "../crypto/crypto.service";
import { AccessControlService } from "../authz/access-control.service";
import { CONNECTOR_REGISTRY } from "./connectors.tokens";

export interface CreateInstanceInput {
  connectorType: string;
  name: string;
  config: Record<string, unknown>;
  credentials: Record<string, unknown>;
}

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

  async list(userId: string, projectId: string) {
    const project = await this.requireProject(projectId);
    await this.acl.assertMember(userId, project.orgId);
    return this.prisma.connectorInstance.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: PUBLIC_FIELDS,
    });
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
