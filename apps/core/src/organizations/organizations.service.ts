import { Injectable, NotFoundException } from "@nestjs/common";
import type { CreateOrganization } from "@orbit/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateOrganization) {
    return this.prisma.organization.create({ data: input });
  }

  findAll() {
    return this.prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException(`Organization not found: ${id}`);
    return org;
  }
}
