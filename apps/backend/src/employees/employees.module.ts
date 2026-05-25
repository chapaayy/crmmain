import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { EmployeesController } from "./employees.controller";
import { EmployeesService } from "./employees.service";

@Module({
  imports: [AuditModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, PermissionsGuard]
})
export class EmployeesModule {}
