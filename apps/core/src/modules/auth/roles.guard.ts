import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { PlatformRole } from "@orbit/shared";
import { ROLES_KEY } from "./decorators";
import type { AuthUser } from "./auth.types";

/**
 * Enforces platform-level roles declared with @Roles(). The role is ORBIT's own
 * (sourced from the user record and carried on the access token), not an
 * external IdP claim. Routes without the decorator are unaffected;
 * per-organization authorization stays in AccessControlService.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PlatformRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user || !required.includes(user.platformRole)) {
      throw new ForbiddenException(
        `Requires platform role: ${required.join(" or ")}`,
      );
    }
    return true;
  }
}
