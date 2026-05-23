import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { NotificationsModule } from "../notifications/notifications.module";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [CustomersController],
  providers: [CustomersService, PermissionsGuard],
  exports: [CustomersService]
})
export class CustomersModule {}
