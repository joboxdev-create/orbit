import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { CreateOrganization, UpdateOrganization } from "@orbit/shared";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { AccessControlService } from "../../shared/authz/access-control.service";

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acl: AccessControlService,
  ) {}

  create(userId: string, input: CreateOrganization) {
    return this.prisma.organization.create({
      data: {
        ...input,
        memberships: { create: { userId, role: "owner" } },
      },
    });
  }

  findAllForUser(userId: string) {
    return this.prisma.organization.findMany({
      where: { memberships: { some: { userId } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(userId: string, id: string) {
    await this.acl.assertMember(userId, id);
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException(`Organization not found: ${id}`);
    return org;
  }

  async update(userId: string, id: string, input: UpdateOrganization) {
    await this.acl.assertMember(userId, id, "admin");
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException(`Organization not found: ${id}`);
    try {
      return await this.prisma.organization.update({
        where: { id },
        data: input,
      });
    } catch (e: any) {
      if (e?.code === "P2002") throw new ConflictException("Slug already taken");
      throw e;
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    const role = await this.acl.assertMember(userId, id, "owner");
    if (role !== "owner") {
      throw new ForbiddenException("Only the owner can delete an organization");
    }
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException(`Organization not found: ${id}`);
    await this.prisma.organization.delete({ where: { id } });
  }
}
