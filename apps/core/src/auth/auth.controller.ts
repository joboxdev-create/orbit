import { Body, Controller, Get, Post } from "@nestjs/common";
import { CreateUserInput, LoginInput, RefreshInput } from "@orbit/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthService } from "./auth.service";
import { CurrentUser, Public, Roles } from "./decorators";
import type { AuthUser } from "./auth.types";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  login(@Body(new ZodValidationPipe(LoginInput)) body: LoginInput) {
    return this.auth.login(body);
  }

  @Public()
  @Post("refresh")
  refresh(@Body(new ZodValidationPipe(RefreshInput)) body: RefreshInput) {
    return this.auth.refresh(body.refreshToken);
  }

  // Admin-managed user creation (no public self-registration).
  @Roles("admin")
  @Post("users")
  createUser(
    @Body(new ZodValidationPipe(CreateUserInput)) body: CreateUserInput,
  ) {
    return this.auth.createUser(body);
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.userId);
  }
}
