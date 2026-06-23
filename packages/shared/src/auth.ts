import { z } from "zod";

/** Organization-scoped roles, ordered from most to least privileged. */
export const Role = z.enum(["owner", "admin", "member", "viewer"]);
export type Role = z.infer<typeof Role>;

/** Higher number = more privileges. Used for `minimum role` checks. */
export const ROLE_RANK: Record<Role, number> = {
  owner: 3,
  admin: 2,
  member: 1,
  viewer: 0,
};

/**
 * Platform-wide role, distinct from the per-organization {@link Role}. ORBIT is
 * its own identity authority (like Keycloak's admin or a database superuser):
 * the `admin` role is bootstrapped from env and can administer the platform,
 * including creating other users. Everyone else is a `member`.
 */
export const PlatformRole = z.enum(["admin", "member"]);
export type PlatformRole = z.infer<typeof PlatformRole>;

/** Role required for platform administration (e.g. creating users). */
export const PLATFORM_ADMIN_ROLE: PlatformRole = "admin";

/** Public-safe user shape (never includes passwordHash). */
export const User = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  /** Identity provider that owns this user, e.g. "local". */
  provider: z.string(),
  /** Platform-wide role (admin can administer ORBIT itself). */
  platformRole: PlatformRole,
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof User>;

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInput>;

/**
 * Input for an admin creating a user. There is no public self-registration:
 * only a platform admin can create accounts (Keycloak/DB-style administration).
 */
export const CreateUserInput = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(120).optional(),
  platformRole: PlatformRole.default("member"),
});
export type CreateUserInput = z.infer<typeof CreateUserInput>;

export const RefreshInput = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof RefreshInput>;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
