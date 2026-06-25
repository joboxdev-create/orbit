import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { CreateProject, UpdateProject } from "@orbit/shared";
import { EngineError } from "@orbit/engine";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { AccessControlService } from "../../shared/authz/access-control.service";
import {
  PrismaProjectRepository,
  toProjectRecord,
} from "./prisma-project.repository";

/**
 * Server adapter over the project domain. Owns only governance (RBAC) and
 * transport (mapping engine errors to HTTP); persistence goes through the
 * engine's ProjectRepository port (Prisma here, filesystem on the desktop).
 */
@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acl: AccessControlService,
    private readonly repo: PrismaProjectRepository,
  ) {}

  async create(userId: string, input: CreateProject) {
    await this.acl.assertMember(userId, input.orgId, "member");
    return this.guard(() => this.repo.create(input));
  }

  async findAll(userId: string, orgId?: string) {
    if (orgId) {
      await this.acl.assertMember(userId, orgId);
      return this.repo.list({ orgId });
    }
    // "All my projects" is a governance-scoped query (by membership), so it
    // stays in the server rather than the host-neutral repository.
    const rows = await this.prisma.project.findMany({
      where: { org: { memberships: { some: { userId } } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toProjectRecord);
  }

  async findOne(userId: string, id: string) {
    const project = await this.repo.findById(id);
    if (!project || !project.orgId) {
      throw new NotFoundException(`Project not found: ${id}`);
    }
    await this.acl.assertMember(userId, project.orgId);
    return project;
  }

  async update(userId: string, id: string, input: UpdateProject) {
    const project = await this.repo.findById(id);
    if (!project || !project.orgId) {
      throw new NotFoundException(`Project not found: ${id}`);
    }
    await this.acl.assertMember(userId, project.orgId, "member");
    return this.guard(() => this.repo.update(id, input));
  }

  async remove(userId: string, id: string): Promise<void> {
    const project = await this.repo.findById(id);
    if (!project || !project.orgId) {
      throw new NotFoundException(`Project not found: ${id}`);
    }
    await this.acl.assertMember(userId, project.orgId, "admin");
    await this.repo.delete(id);
  }

  /** Run a repository call, mapping framework-free engine errors to HTTP. */
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
