import { Body, Controller, Get, Post } from "@nestjs/common";
import {
  LoginInput,
  RefreshInput,
  RegisterInput,
} from "@orbit/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthService } from "./auth.service";
import { CurrentUser, Public } from "./decorators";
import type { AuthUser } from "./auth.types";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("register")
  register(@Body(new ZodValidationPipe(RegisterInput)) body: RegisterInput) {
    return this.auth.register(body);
  }

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

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.userId);
  }
}
