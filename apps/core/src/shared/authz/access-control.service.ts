import { ForbiddenException, Injectable } from "@nestjs/common";
import { type Role, ROLE_RANK } from "@orbit/shared";
import { PrismaService } from "../prisma/prisma.service";

/** Central authorization: membership + role checks, scoped per organization. */
@Injectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  getMembership(userId: string, orgId: string) {
    return this.prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
    });
  }

  /** Throw unless the user is a member of the org with at least `minRole`. */
  async assertMember(
    userId: string,
    orgId: string,
    minRole: Role = "viewer",
  ): Promise<Role> {
    const membership = await this.getMembership(userId, orgId);
    if (!membership) {
      throw new ForbiddenException("Not a member of this organization");
    }
    const role = membership.role as Role;
    if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
      throw new ForbiddenException(`Requires role '${minRole}' or higher`);
    }
    return role;
  }

  async orgIdsForUser(userId: string): Promise<string[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      select: { orgId: true },
    });
    return memberships.map((m) => m.orgId);
  }
}
