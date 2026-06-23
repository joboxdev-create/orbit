import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CreateOrganization } from "@orbit/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { OrganizationsService } from "./organizations.service";

@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(CreateOrganization)) body: CreateOrganization,
  ) {
    return this.organizations.create(body);
  }

  @Get()
  list() {
    return this.organizations.findAll();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.organizations.findOne(id);
  }
}
