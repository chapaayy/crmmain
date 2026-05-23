import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PermissionsGuard],
  exports: [PaymentsService]
})
export class PaymentsModule {}
