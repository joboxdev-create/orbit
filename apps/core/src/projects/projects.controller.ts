import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CreateProject } from "@orbit/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ProjectsService } from "./projects.service";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(@Body(new ZodValidationPipe(CreateProject)) body: CreateProject) {
    return this.projects.create(body);
  }

  @Get()
  list(@Query("orgId") orgId?: string) {
    return this.projects.findAll(orgId);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.projects.findOne(id);
  }
}
