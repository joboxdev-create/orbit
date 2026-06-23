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

/** Public-safe user shape (never includes passwordHash). */
export const User = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  provider: z.string(),
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof User>;

export const RegisterInput = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(120).optional(),
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const RefreshInput = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof RefreshInput>;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
