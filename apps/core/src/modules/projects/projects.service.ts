import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { CreateProject, UpdateProject } from "@orbit/shared";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { AccessControlService } from "../../shared/authz/access-control.service";

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acl: AccessControlService,
  ) {}

  async create(userId: string, input: CreateProject) {
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

  async update(userId: string, id: string, input: UpdateProject) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException(`Project not found: ${id}`);
    await this.acl.assertMember(userId, project.orgId, "member");
    try {
      return await this.prisma.project.update({ where: { id }, data: input });
    } catch (e: any) {
      if (e?.code === "P2002") throw new ConflictException("Slug already taken in this organization");
      throw e;
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException(`Project not found: ${id}`);
    await this.acl.assertMember(userId, project.orgId, "admin");
    await this.prisma.project.delete({ where: { id } });
  }
}
