import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SecretsController } from "./secrets.controller";
import { SecretsService } from "./secrets.service";

@Module({
  imports: [AuditModule],
  controllers: [SecretsController],
  providers: [SecretsService, PermissionsGuard]
})
export class SecretsModule {}
