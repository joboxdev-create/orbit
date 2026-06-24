import { Injectable, NotFoundException } from "@nestjs/common";
import type { CreateProject } from "@orbit/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AccessControlService } from "../authz/access-control.service";

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acl: AccessControlService,
  ) {}

  async create(userId: string, input: CreateProject) {
    // Must be at least a member of the target org to add projects.
    await this.acl.assertMember(userId, input.orgId, "member");
    return this.prisma.project.create({ data: input });
  }

  async findAll(userId: string, orgId?: string) {
    if (orgId) {
      await this.acl.assertMember(userId, orgId);
      return this.prisma.project.findMany({
        where: { orgId },
        orderBy: { createdAt: "desc" },
      });
    }
    // No org filter: every project across the user's organizations.
    return this.prisma.project.findMany({
      where: { org: { memberships: { some: { userId } } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(userId: string, id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException(`Project not found: ${id}`);
    await this.acl.assertMember(userId, project.orgId);
    return project;
  }
}
