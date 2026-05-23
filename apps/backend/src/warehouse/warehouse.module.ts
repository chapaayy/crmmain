import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { NotificationsModule } from "../notifications/notifications.module";
import { WarehouseController } from "./warehouse.controller";
import { WarehouseService } from "./warehouse.service";
import { WarehousesController } from "./warehouses.controller";

@Module({
  imports: [NotificationsModule],
  controllers: [WarehousesController, WarehouseController],
  providers: [WarehouseService, PermissionsGuard]
})
export class WarehouseModule {}
