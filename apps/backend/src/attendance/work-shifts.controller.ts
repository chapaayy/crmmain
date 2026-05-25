import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { AttendanceService } from "./attendance.service";
import { CreateWorkShiftDto, UpdateWorkShiftDto } from "./dto/attendance.dto";
import { WorkShiftQueryDto } from "./dto/attendance-query.dto";

@ApiTags("work-shifts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("work-shifts")
export class WorkShiftsController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  @RequirePermissions("attendance.read")
  list(@Query() query: WorkShiftQueryDto) {
    return this.attendanceService.listShifts(query);
  }

  @Post()
  @RequirePermissions("attendance.manage")
  create(@Body() dto: CreateWorkShiftDto, @CurrentUser("userId") actorId: string) {
    return this.attendanceService.createShift(dto, actorId);
  }

  @Patch(":id")
  @RequirePermissions("attendance.manage")
  update(@Param("id") id: string, @Body() dto: UpdateWorkShiftDto, @CurrentUser("userId") actorId: string) {
    return this.attendanceService.updateShift(id, dto, actorId);
  }

  @Delete(":id")
  @RequirePermissions("attendance.manage")
  delete(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.attendanceService.deleteShift(id, actorId);
  }
}
