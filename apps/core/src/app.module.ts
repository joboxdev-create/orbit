import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./shared/prisma/prisma.module";
import { CryptoModule } from "./shared/crypto/crypto.module";
import { AccessControlModule } from "./shared/authz/access-control.module";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { ConnectorsModule } from "./modules/connectors/connectors.module";

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
