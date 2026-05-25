import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ResponsibilitiesController } from "./responsibilities.controller";
import { ResponsibilitiesService } from "./responsibilities.service";

@Module({
  imports: [AuditModule],
  controllers: [ResponsibilitiesController],
  providers: [ResponsibilitiesService, PermissionsGuard],
  exports: [ResponsibilitiesService]
})
export class ResponsibilitiesModule {}
