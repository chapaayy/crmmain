import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { NotificationsModule } from "../notifications/notifications.module";
import { LeadsController } from "./leads.controller";
import { LeadsService } from "./leads.service";

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [LeadsController],
  providers: [LeadsService, PermissionsGuard]
})
export class LeadsModule {}
