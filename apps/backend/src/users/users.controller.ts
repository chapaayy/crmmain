import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { AssignUserRolesDto } from "../rbac/dto/assign-user-roles.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateActiveDto } from "./dto/update-active.dto";
import { UpdatePasswordDto } from "./dto/update-password.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions("users.read")
  list(@Query() query: PaginationQueryDto) {
    return this.usersService.list(query);
  }

  @Post()
  @RequirePermissions("users.create")
  create(@Body() dto: CreateUserDto, @CurrentUser("userId") actorId: string) {
    return this.usersService.create(dto, actorId);
  }

  @Get(":id")
  @RequirePermissions("users.read")
  findOne(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(":id")
  @RequirePermissions("users.update")
  update(@Param("id") id: string, @Body() dto: UpdateUserDto, @CurrentUser("userId") actorId: string) {
    return this.usersService.update(id, dto, actorId);
  }

  @Delete(":id")
  @RequirePermissions("users.delete")
  softDelete(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.usersService.softDelete(id, actorId);
  }

  @Patch(":id/password")
  @RequirePermissions("users.update")
  updatePassword(@Param("id") id: string, @Body() dto: UpdatePasswordDto, @CurrentUser("userId") actorId: string) {
    return this.usersService.updatePassword(id, dto, actorId);
  }

  @Patch(":id/active")
  @RequirePermissions("users.update")
  updateActive(@Param("id") id: string, @Body() dto: UpdateActiveDto, @CurrentUser("userId") actorId: string) {
    return this.usersService.updateActive(id, dto, actorId);
  }

  @Post(":id/roles")
  @RequirePermissions("users.update", "roles.manage")
  assignRoles(
    @Param("id") userId: string,
    @Body() dto: AssignUserRolesDto,
    @CurrentUser("userId") assignedById: string
  ) {
    return this.usersService.assignRoles(userId, dto, assignedById);
  }
}
