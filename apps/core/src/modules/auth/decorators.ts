import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from "@nestjs/common";
import type { PlatformRole } from "@orbit/shared";
import type { AuthUser } from "./auth.types";

export const IS_PUBLIC_KEY = "isPublic";
/** Mark a route as accessible without authentication. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = "roles";
/** Require one or more platform-level roles (e.g. "admin"). */
export const Roles = (...roles: PlatformRole[]) => SetMetadata(ROLES_KEY, roles);

/** Inject the authenticated user (`request.user`) into a handler param. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
