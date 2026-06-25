import { Injectable } from "@nestjs/common";
import { Prisma, type Project } from "@prisma/client";
import {
  badRequest,
  conflict,
  type CreateProjectData,
  type ProjectListFilter,
  type ProjectRecord,
  type ProjectRepository,
  type UpdateProjectData,
} from "@orbit/engine";
import { PrismaService } from "../../shared/prisma/prisma.service";

/** Postgres-backed adapter for the engine's ProjectRepository port. */
@Injectable()
export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateProjectData): Promise<ProjectRecord> {
    // The server always scopes a project to an organization.
    if (data.orgId == null) throw badRequest("orgId is required");
    try {
      const row = await this.prisma.project.create({
        data: {
          orgId: data.orgId,
          name: data.name,
          slug: data.slug,
          description: data.description ?? null,
        },
      });
      return toProjectRecord(row);
    } catch (err) {
      throw mapPrisma(err);
    }
  }

  async findById(id: string): Promise<ProjectRecord | null> {
    const row = await this.prisma.project.findUnique({ where: { id } });
    return row ? toProjectRecord(row) : null;
  }

  async list(filter?: ProjectListFilter): Promise<ProjectRecord[]> {
    const rows = await this.prisma.project.findMany({
      where: filter?.orgId ? { orgId: filter.orgId } : undefined,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toProjectRecord);
  }

  async update(
    id: string,
    patch: UpdateProjectData,
  ): Promise<ProjectRecord> {
    try {
      const row = await this.prisma.project.update({
        where: { id },
        data: {
          ...(patch.name !== undefined && { name: patch.name }),
          ...(patch.slug !== undefined && { slug: patch.slug }),
          ...(patch.description !== undefined && {
            description: patch.description,
          }),
        },
      });
      return toProjectRecord(row);
    } catch (err) {
      throw mapPrisma(err);
    }
  }

  async delete(id: string): Promise<void> {
    await this.prisma.project.delete({ where: { id } });
  }
}

export function toProjectRecord(row: Project): ProjectRecord {
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Translate store-specific Prisma errors into framework-free engine errors. */
function mapPrisma(err: unknown): unknown {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    return conflict("Slug already taken in this organization");
  }
  return err;
}
