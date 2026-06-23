import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
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
  type User,
} from "@orbit/shared";
import { PrismaService } from "../prisma/prisma.service";
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

  /**
   * Seed the bootstrap admin on startup. ORBIT owns its own identity (like
   * Keycloak's admin or a database superuser): the first admin is provisioned
   * from env, idempotently, so the platform is reachable before any user
   * exists. Other users are then created by an admin (no public signup).
   */
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

  /**
   * Create a user. There is no public self-registration: the controller gates
   * this behind @Roles("admin"), so only a platform admin reaches it.
   */
  async createUser(input: CreateUserInput): Promise<User> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      throw new ConflictException("Email already registered");
    }
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
    if (!ok) {
      throw new UnauthorizedException("Invalid credentials");
    }
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
    // expiresIn accepts strings like "15m" at runtime; its type is a strict
    // template literal, so the env-sourced string is cast through.
    const accessTtl = (this.config.get<string>("JWT_ACCESS_TTL") ??
      "15m") as unknown as number;
    const refreshTtl = (this.config.get<string>("JWT_REFRESH_TTL") ??
      "7d") as unknown as number;
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
