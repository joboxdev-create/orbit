import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from "@nestjs/common";
import type { AuthUser } from "./auth.types";

export const IS_PUBLIC_KEY = "isPublic";
/** Mark a route as accessible without authentication. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Inject the authenticated user (`request.user`) into a handler param. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
