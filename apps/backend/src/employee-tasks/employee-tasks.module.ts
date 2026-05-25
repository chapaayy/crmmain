import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { EmployeeTasksController } from "./employee-tasks.controller";
import { EmployeeTasksService } from "./employee-tasks.service";

@Module({
  imports: [AuditModule],
  controllers: [EmployeeTasksController],
  providers: [EmployeeTasksService, PermissionsGuard]
})
export class EmployeeTasksModule {}
