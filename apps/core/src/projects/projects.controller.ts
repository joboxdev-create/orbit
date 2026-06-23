import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CreateProject } from "@orbit/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentUser } from "../auth/decorators";
import type { AuthUser } from "../auth/auth.types";
import { ProjectsService } from "./projects.service";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateProject)) body: CreateProject,
  ) {
    return this.projects.create(user.userId, body);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("orgId") orgId?: string) {
    return this.projects.findAll(user.userId, orgId);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.projects.findOne(user.userId, id);
  }
}
