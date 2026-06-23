import type { PlatformRole } from "@orbit/shared";

/** Shape attached to `request.user` after a valid access token. */
export interface AuthUser {
  userId: string;
  email: string;
  /** Platform-wide role (e.g. "admin"). Not the per-organization role. */
  platformRole: PlatformRole;
}

export interface JwtPayload {
  sub: string;
  email: string;
  platformRole: PlatformRole;
  type: "access" | "refresh";
}
