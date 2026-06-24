import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { User as PrismaUser } from "@prisma/client";
import {
  type AuthTokens,
  type CreateUserInput,
  type LoginInput,
  PLATFORM_ADMIN_ROLE,
  type PlatformRole,
  type UpdateUserInput,
  type User,
} from "@orbit/shared";
import { PrismaService } from "../../shared/prisma/prisma.service";
import type { JwtPayload } from "./auth.types";
import {
  IDENTITY_PROVIDER,
  type IdentityProvider,
} from "./identity/identity-provider";

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(IDENTITY_PROVIDER)
    private readonly identity: IdentityProvider,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.config.get<string>("ORBIT_ADMIN_EMAIL");
    const password = this.config.get<string>("ORBIT_ADMIN_PASSWORD");
    if (!email || !password) {
      this.logger.warn(
        "ORBIT_ADMIN_EMAIL/ORBIT_ADMIN_PASSWORD not set; skipping bootstrap admin.",
      );
      return;
    }
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) return;
    await this.prisma.user.create({
      data: {
        email,
        name: "ORBIT Admin",
        provider: this.identity.name,
        platformRole: PLATFORM_ADMIN_ROLE,
        passwordHash: await this.identity.hashSecret(password),
      },
    });
    this.logger.log(`Bootstrap admin provisioned: ${email}`);
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) throw new ConflictException("Email already registered");
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        provider: this.identity.name,
        platformRole: input.platformRole,
        passwordHash: await this.identity.hashSecret(input.password),
      },
    });
    return toPublicUser(user);
  }

  async listUsers(): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: "asc" },
    });
    return users.map(toPublicUser);
  }

  async getUser(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User not found: ${id}`);
    return toPublicUser(user);
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User not found: ${id}`);

    if (input.email && input.email !== user.email) {
      const taken = await this.prisma.user.findUnique({
        where: { email: input.email },
      });
      if (taken) throw new ConflictException("Email already registered");
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.platformRole !== undefined && {
          platformRole: input.platformRole,
        }),
        ...(input.password !== undefined && {
          passwordHash: await this.identity.hashSecret(input.password),
        }),
      },
    });
    return toPublicUser(updated);
  }

  async deleteUser(actorId: string, targetId: string): Promise<void> {
    if (actorId === targetId) {
      throw new BadRequestException("Cannot delete your own account");
    }
    const user = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!user) throw new NotFoundException(`User not found: ${targetId}`);
    await this.prisma.user.delete({ where: { id: targetId } });
  }

  async login(input: LoginInput): Promise<{ user: User; tokens: AuthTokens }> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const ok = await this.identity.verifySecret(
      input.password,
      user.passwordHash,
    );
    if (!ok) throw new UnauthorizedException("Invalid credentials");
    return { user: toPublicUser(user), tokens: this.issueTokens(user) };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>("JWT_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
    if (payload.type !== "refresh") {
      throw new UnauthorizedException("Invalid token type");
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) throw new UnauthorizedException("User no longer exists");
    return this.issueTokens(user);
  }

  async me(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return toPublicUser(user);
  }

  private issueTokens(user: PrismaUser): AuthTokens {
    const secret = this.config.getOrThrow<string>("JWT_SECRET");
    const base = {
      sub: user.id,
      email: user.email,
      platformRole: user.platformRole as PlatformRole,
    };
    const accessTtl = (this.config.get<string>("JWT_ACCESS_TTL") ??
      "15m") as unknown as number;
    // Default refresh TTL = 8 hours, matching the NextAuth session maxAge.
    const refreshTtl = (this.config.get<string>("JWT_REFRESH_TTL") ??
      "8h") as unknown as number;
    return {
      accessToken: this.jwt.sign(
        { ...base, type: "access" },
        { secret, expiresIn: accessTtl },
      ),
      refreshToken: this.jwt.sign(
        { ...base, type: "refresh" },
        { secret, expiresIn: refreshTtl },
      ),
    };
  }
}

function toPublicUser(user: PrismaUser): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    provider: user.provider,
    platformRole: user.platformRole as PlatformRole,
    createdAt: user.createdAt.toISOString(),
  };
}
