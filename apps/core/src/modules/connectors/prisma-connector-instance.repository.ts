import { Injectable } from "@nestjs/common";
import { Prisma, type ConnectorInstance } from "@prisma/client";
import type {
  ConnectorInstanceRecord,
  ConnectorInstanceRepository,
  ConnectorInstanceStatus,
  CreateConnectorInstanceData,
  UpdateConnectorInstanceData,
} from "@orbit/engine";
import { PrismaService } from "../../shared/prisma/prisma.service";

/** Postgres-backed adapter for the engine's ConnectorInstanceRepository port. */
@Injectable()
export class PrismaConnectorInstanceRepository
  implements ConnectorInstanceRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: CreateConnectorInstanceData,
  ): Promise<ConnectorInstanceRecord> {
    const row = await this.prisma.connectorInstance.create({
      data: {
        projectId: data.projectId,
        connectorType: data.connectorType,
        layer: data.layer,
        name: data.name,
        status: data.status ?? "configured",
        config: (data.config ?? {}) as Prisma.InputJsonValue,
        encryptedCredentials: data.encryptedCredentials ?? null,
      },
    });
    return toRecord(row);
  }

  async findById(id: string): Promise<ConnectorInstanceRecord | null> {
    const row = await this.prisma.connectorInstance.findUnique({
      where: { id },
    });
    return row ? toRecord(row) : null;
  }

  async findByProject(
    projectId: string,
  ): Promise<ConnectorInstanceRecord[]> {
    const rows = await this.prisma.connectorInstance.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toRecord);
  }

  async update(
    id: string,
    patch: UpdateConnectorInstanceData,
  ): Promise<ConnectorInstanceRecord> {
    const row = await this.prisma.connectorInstance.update({
      where: { id },
      data: {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.layer !== undefined && { layer: patch.layer }),
        ...(patch.status !== undefined && { status: patch.status }),
        ...(patch.config !== undefined && {
          config: patch.config as Prisma.InputJsonValue,
        }),
        ...(patch.encryptedCredentials !== undefined && {
          encryptedCredentials: patch.encryptedCredentials,
        }),
      },
    });
    return toRecord(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.connectorInstance.delete({ where: { id } });
  }
}

function toRecord(row: ConnectorInstance): ConnectorInstanceRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    connectorType: row.connectorType,
    layer: row.layer,
    name: row.name,
    status: row.status as ConnectorInstanceStatus,
    config: (row.config ?? {}) as Record<string, unknown>,
    encryptedCredentials: row.encryptedCredentials ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
