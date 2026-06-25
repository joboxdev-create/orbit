import { Module } from "@nestjs/common";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { PrismaProjectRepository } from "./prisma-project.repository";

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, PrismaProjectRepository],
})
export class ProjectsModule {}
