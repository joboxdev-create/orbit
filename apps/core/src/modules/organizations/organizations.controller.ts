import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CreateOrganization } from "@orbit/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentUser } from "../auth/decorators";
import type { AuthUser } from "../auth/auth.types";
import { OrganizationsService } from "./organizations.service";

@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateOrganization)) body: CreateOrganization,
  ) {
    return this.organizations.create(user.userId, body);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.organizations.findAllForUser(user.userId);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.organizations.findOne(user.userId, id);
  }
}
