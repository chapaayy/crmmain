import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CreateEmployeeTaskDto, UpdateEmployeeTaskDto } from "./dto/employee-task.dto";
import { EmployeeTaskQueryDto } from "./dto/employee-task-query.dto";
import { EmployeeTasksService } from "./employee-tasks.service";

@ApiTags("employee-tasks")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("employee-tasks")
export class EmployeeTasksController {
  constructor(private readonly employeeTasksService: EmployeeTasksService) {}

  @Get()
  @RequirePermissions("employee_tasks.read")
  list(@Query() query: EmployeeTaskQueryDto, @CurrentUser("userId") actorId: string) {
    return this.employeeTasksService.list(query, actorId);
  }

  @Post()
  @RequirePermissions("employee_tasks.create")
  create(@Body() dto: CreateEmployeeTaskDto, @CurrentUser("userId") actorId: string) {
    return this.employeeTasksService.create(dto, actorId);
  }

  @Get(":id")
  @RequirePermissions("employee_tasks.read")
  get(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.employeeTasksService.get(id, actorId);
  }

  @Patch(":id")
  @RequirePermissions("employee_tasks.update")
  update(@Param("id") id: string, @Body() dto: UpdateEmployeeTaskDto, @CurrentUser("userId") actorId: string) {
    return this.employeeTasksService.update(id, dto, actorId);
  }

  @Delete(":id")
  @RequirePermissions("employee_tasks.delete")
  delete(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.employeeTasksService.delete(id, actorId);
  }

  @Post(":id/complete")
  @RequirePermissions("employee_tasks.read")
  complete(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.employeeTasksService.complete(id, actorId);
  }

  @Post(":id/reopen")
  @RequirePermissions("employee_tasks.read")
  reopen(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.employeeTasksService.reopen(id, actorId);
  }
}
