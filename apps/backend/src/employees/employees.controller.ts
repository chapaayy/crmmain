import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CreateEmployeeDto, CreateWorkScheduleDto, UpdateEmployeeDto, UpdateWorkScheduleDto } from "./dto/employee.dto";
import { EmployeeQueryDto } from "./dto/employee-query.dto";
import { EmployeesService } from "./employees.service";

@ApiTags("employees")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get("employees")
  @RequirePermissions("employees.read")
  list(@Query() query: EmployeeQueryDto) {
    return this.employeesService.list(query);
  }

  @Post("employees")
  @RequirePermissions("employees.create")
  create(@Body() dto: CreateEmployeeDto, @CurrentUser("userId") actorId: string) {
    return this.employeesService.create(dto, actorId);
  }

  @Get("employees/:id")
  @RequirePermissions("employees.read")
  get(@Param("id") id: string) {
    return this.employeesService.get(id);
  }

  @Patch("employees/:id")
  @RequirePermissions("employees.update")
  update(@Param("id") id: string, @Body() dto: UpdateEmployeeDto, @CurrentUser("userId") actorId: string) {
    return this.employeesService.update(id, dto, actorId);
  }

  @Delete("employees/:id")
  @RequirePermissions("employees.delete")
  delete(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.employeesService.delete(id, actorId);
  }

  @Get("employees/:id/schedules")
  @RequirePermissions("employees.read")
  listSchedules(@Param("id") id: string) {
    return this.employeesService.listSchedules(id);
  }

  @Post("employees/:id/schedules")
  @RequirePermissions("employees.update")
  createSchedule(@Param("id") id: string, @Body() dto: CreateWorkScheduleDto, @CurrentUser("userId") actorId: string) {
    return this.employeesService.createSchedule(id, dto, actorId);
  }

  @Patch("work-schedules/:id")
  @RequirePermissions("employees.update")
  updateSchedule(@Param("id") id: string, @Body() dto: UpdateWorkScheduleDto, @CurrentUser("userId") actorId: string) {
    return this.employeesService.updateSchedule(id, dto, actorId);
  }

  @Delete("work-schedules/:id")
  @RequirePermissions("employees.update")
  deleteSchedule(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.employeesService.deleteSchedule(id, actorId);
  }
}
