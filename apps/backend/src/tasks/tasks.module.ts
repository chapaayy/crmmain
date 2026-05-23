import { Module } from "@nestjs/common";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { NotificationsModule } from "../notifications/notifications.module";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

@Module({
  imports: [NotificationsModule],
  controllers: [TasksController],
  providers: [TasksService, PermissionsGuard],
  exports: [TasksService]
})
export class TasksModule {}
