import { Injectable, NotFoundException } from "@nestjs/common";
import type { CreateProject } from "@orbit/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateProject) {
    // Surfacing a clear error beats a raw FK violation if the org is missing.
    const org = await this.prisma.organization.findUnique({
      where: { id: input.orgId },
    });
    if (!org) throw new NotFoundException(`Organization not found: ${input.orgId}`);
    return this.prisma.project.create({ data: input });
  }

  findAll(orgId?: string) {
    return this.prisma.project.findMany({
      where: orgId ? { orgId } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException(`Project not found: ${id}`);
    return project;
  }
}
