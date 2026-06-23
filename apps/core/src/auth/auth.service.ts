import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { User as PrismaUser } from "@prisma/client";
import type { AuthTokens, LoginInput, RegisterInput, User } from "@orbit/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { JwtPayload } from "./auth.types";
import {
  IDENTITY_PROVIDER,
  type IdentityProvider,
} from "./identity/identity-provider";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(IDENTITY_PROVIDER)
    private readonly identity: IdentityProvider,
  ) {}

  async register(
    input: RegisterInput,
  ): Promise<{ user: User; tokens: AuthTokens }> {
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
        passwordHash: await this.identity.hashSecret(input.password),
      },
    });
    return { user: toPublicUser(user), tokens: this.issueTokens(user) };
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
    const base = { sub: user.id, email: user.email };
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
    createdAt: user.createdAt.toISOString(),
  };
}
