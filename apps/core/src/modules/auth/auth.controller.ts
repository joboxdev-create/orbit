import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import {
  CreateUserInput,
  LoginInput,
  RefreshInput,
  UpdateUserInput,
} from "@orbit/shared";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
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

  @Roles("admin")
  @Post("users")
  createUser(
    @Body(new ZodValidationPipe(CreateUserInput)) body: CreateUserInput,
  ) {
    return this.auth.createUser(body);
  }

  @Roles("admin")
  @Get("users")
  listUsers() {
    return this.auth.listUsers();
  }

  @Roles("admin")
  @Get("users/:id")
  getUser(@Param("id") id: string) {
    return this.auth.getUser(id);
  }

  @Roles("admin")
  @Patch("users/:id")
  updateUser(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateUserInput)) body: UpdateUserInput,
  ) {
    return this.auth.updateUser(id, body);
  }

  @Roles("admin")
  @Delete("users/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteUser(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.auth.deleteUser(actor.userId, id);
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.userId);
  }
}
