import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { CryptoModule } from "./crypto/crypto.module";
import { AccessControlModule } from "./authz/access-control.module";
import { AuthModule } from "./auth/auth.module";
import { HealthModule } from "./health/health.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { ProjectsModule } from "./projects/projects.module";
import { ConnectorsModule } from "./connectors/connectors.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CryptoModule,
    AccessControlModule,
    AuthModule,
    HealthModule,
    OrganizationsModule,
    ProjectsModule,
    ConnectorsModule,
  ],
})
export class AppModule {}
