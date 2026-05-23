import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { NotificationsModule } from "../notifications/notifications.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [NotificationsModule],
  controllers: [OrdersController],
  providers: [OrdersService, PermissionsGuard]
})
export class OrdersModule {}
