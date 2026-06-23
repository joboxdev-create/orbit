import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { JwtStrategy } from "./jwt.strategy";
import { IDENTITY_PROVIDER } from "./identity/identity-provider";
import { LocalPasswordProvider } from "./identity/local-password.provider";

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    LocalPasswordProvider,
    { provide: IDENTITY_PROVIDER, useExisting: LocalPasswordProvider },
    // Authenticate every route globally; opt out with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AuthModule {}
