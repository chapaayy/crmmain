import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { AttendanceService } from "./attendance.service";
import { TimeEntriesController } from "./time-entries.controller";
import { WorkShiftsController } from "./work-shifts.controller";

@Module({
  imports: [AuditModule],
  controllers: [TimeEntriesController, WorkShiftsController],
  providers: [AttendanceService, PermissionsGuard]
})
export class AttendanceModule {}
