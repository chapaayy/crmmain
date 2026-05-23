import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

@Module({
  imports: [AuditModule],
  controllers: [SettingsController],
  providers: [SettingsService, PermissionsGuard]
})
export class SettingsModule {}
