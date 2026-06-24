import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentUser } from "../auth/decorators";
import type { AuthUser } from "../auth/auth.types";
import {
  ConnectorInstancesService,
  type CreateInstanceInput,
} from "./connector-instances.service";

const CreateInstanceBody = z.object({
  connectorType: z.string().min(1),
  name: z.string().min(1).max(120),
  config: z.record(z.unknown()).default({}),
  credentials: z.record(z.unknown()).default({}),
});

@Controller()
export class ConnectorInstancesController {
  constructor(private readonly service: ConnectorInstancesService) {}

  @Post("projects/:projectId/connectors")
  create(
    @CurrentUser() user: AuthUser,
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(CreateInstanceBody)) body: CreateInstanceInput,
  ) {
    return this.service.create(user.userId, projectId, body);
  }

  @Get("projects/:projectId/connectors")
  list(@CurrentUser() user: AuthUser, @Param("projectId") projectId: string) {
    return this.service.list(user.userId, projectId);
  }

  @Post("connector-instances/:id/capabilities/:name")
  invoke(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("name") name: string,
    @Body() body: unknown,
  ) {
    return this.service.invoke(user.userId, id, name, body ?? {});
  }
}
