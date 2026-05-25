import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { AttendanceService } from "./attendance.service";
import { CreateTimeEntryDto, RejectTimeEntryDto, UpdateTimeEntryDto } from "./dto/attendance.dto";
import { TimeEntryQueryDto } from "./dto/attendance-query.dto";

@ApiTags("time-entries")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("time-entries")
export class TimeEntriesController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  list(@Query() query: TimeEntryQueryDto, @CurrentUser("userId") actorId: string) {
    return this.attendanceService.listTimeEntries(query, actorId);
  }

  @Post()
  create(@Body() dto: CreateTimeEntryDto, @CurrentUser("userId") actorId: string) {
    return this.attendanceService.createTimeEntry(dto, actorId);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateTimeEntryDto, @CurrentUser("userId") actorId: string) {
    return this.attendanceService.updateTimeEntry(id, dto, actorId);
  }

  @Delete(":id")
  delete(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.attendanceService.deleteTimeEntry(id, actorId);
  }

  @Post(":id/submit")
  submit(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.attendanceService.submitTimeEntry(id, actorId);
  }

  @Post(":id/approve")
  @RequirePermissions("attendance.manage")
  approve(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.attendanceService.approveTimeEntry(id, actorId);
  }

  @Post(":id/reject")
  @RequirePermissions("attendance.manage")
  reject(@Param("id") id: string, @Body() dto: RejectTimeEntryDto, @CurrentUser("userId") actorId: string) {
    return this.attendanceService.rejectTimeEntry(id, dto, actorId);
  }
}
