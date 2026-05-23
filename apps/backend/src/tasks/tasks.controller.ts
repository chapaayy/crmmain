import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CreateTaskDto, UpdateTaskDto, UpdateTaskStatusDto } from "./dto/task.dto";
import { TaskQueryDto } from "./dto/task-query.dto";
import { TasksService } from "./tasks.service";

@ApiTags("tasks")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("tasks")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @RequirePermissions("tasks.read")
  list(@Query() query: TaskQueryDto, @CurrentUser("userId") actorId: string) {
    return this.tasksService.list(query, actorId);
  }

  @Post()
  @RequirePermissions("tasks.create")
  create(@Body() dto: CreateTaskDto, @CurrentUser("userId") actorId: string) {
    return this.tasksService.create(dto, actorId);
  }

  @Get(":id")
  @RequirePermissions("tasks.read")
  get(@Param("id") id: string) {
    return this.tasksService.get(id);
  }

  @Patch(":id")
  @RequirePermissions("tasks.update")
  update(@Param("id") id: string, @Body() dto: UpdateTaskDto, @CurrentUser("userId") actorId: string) {
    return this.tasksService.update(id, dto, actorId);
  }

  @Delete(":id")
  @RequirePermissions("tasks.delete")
  delete(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.tasksService.delete(id, actorId);
  }

  @Patch(":id/status")
  @RequirePermissions("tasks.update")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateTaskStatusDto, @CurrentUser("userId") actorId: string) {
    return this.tasksService.updateStatus(id, dto, actorId);
  }
}
