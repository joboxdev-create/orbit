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
import { z } from "zod";
import type { CallApiInput } from "@orbit/engine";
import { LayerKind } from "@orbit/shared";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentUser } from "../auth/decorators";
import type { AuthUser } from "../auth/auth.types";
import {
  ConnectorInstancesService,
  type CreateInstanceInput,
  type RegisterInstanceInput,
  type UpdateInstanceInput,
} from "./connector-instances.service";

const CreateInstanceBody = z.object({
  connectorType: z.string().min(1),
  name: z.string().min(1).max(120),
  config: z.record(z.unknown()).default({}),
  credentials: z.record(z.unknown()).default({}),
});

const RegisterInstanceBody = z.object({
  source: z.enum(["catalog", "custom"]),
  name: z.string().min(1).max(120),
  connectorType: z.string().min(1).optional(),
  layer: LayerKind.optional(),
  config: z.record(z.unknown()).default({}),
});

const ConnectBody = z.object({
  credentials: z.record(z.unknown()).default({}),
});

const CallApiBody = z.object({
  operationId: z.string().min(1).optional(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(),
  path: z.string().min(1).optional(),
  pathParams: z.record(z.union([z.string(), z.number()])).optional(),
  query: z
    .record(z.union([z.string(), z.number(), z.boolean()]).optional())
    .optional(),
  body: z.unknown().optional(),
});

const UpdateInstanceBody = z.object({
  name: z.string().min(1).max(120).optional(),
  layer: LayerKind.optional(),
  config: z.record(z.unknown()).optional(),
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

  @Post("projects/:projectId/connectors/register")
  register(
    @CurrentUser() user: AuthUser,
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(RegisterInstanceBody))
    body: RegisterInstanceInput,
  ) {
    return this.service.register(user.userId, projectId, body);
  }

  @Get("projects/:projectId/connectors")
  list(@CurrentUser() user: AuthUser, @Param("projectId") projectId: string) {
    return this.service.list(user.userId, projectId);
  }

  @Post("connector-instances/:id/connect")
  connect(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ConnectBody)) body: { credentials: unknown },
  ) {
    return this.service.connect(user.userId, id, body.credentials);
  }

  @Post("connector-instances/:id/disconnect")
  disconnect(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.disconnect(user.userId, id);
  }

  @Patch("connector-instances/:id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateInstanceBody)) body: UpdateInstanceInput,
  ) {
    return this.service.update(user.userId, id, body);
  }

  @Delete("connector-instances/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.remove(user.userId, id);
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

  @Post("connector-instances/:id/api")
  callApi(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(CallApiBody)) body: CallApiInput,
  ) {
    return this.service.callApi(user.userId, id, body);
  }
}
