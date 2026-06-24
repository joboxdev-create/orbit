import { Injectable, NotFoundException } from "@nestjs/common";
import type { CreateOrganization } from "@orbit/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AccessControlService } from "../authz/access-control.service";

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly acl: AccessControlService,
  ) {}

  /** Create an org and make the creator its owner, atomically. */
  create(userId: string, input: CreateOrganization) {
    return this.prisma.organization.create({
      data: {
        ...input,
        memberships: { create: { userId, role: "owner" } },
      },
    });
  }

  /** Only organizations the user belongs to. */
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
}
