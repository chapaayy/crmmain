import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";

@Module({
  controllers: [AuditController],
  providers: [AuditService, PermissionsGuard],
  exports: [AuditService]
})
export class AuditModule {}
