import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRolePermissionsDto } from "./dto/update-role-permissions.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { RbacService } from "./rbac.service";

@ApiTags("roles")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("roles")
export class RolesController {
  constructor(private readonly rbacService: RbacService) {}

  @Get()
  @RequirePermissions("roles.read")
  listRoles() {
    return this.rbacService.listRoles();
  }

  @Post()
  @RequirePermissions("roles.manage")
  createRole(@Body() dto: CreateRoleDto, @CurrentUser("userId") userId: string) {
    return this.rbacService.createRole(dto, userId);
  }

  @Patch(":id")
  @RequirePermissions("roles.manage")
  updateRole(@Param("id") roleId: string, @Body() dto: UpdateRoleDto, @CurrentUser("userId") userId: string) {
    return this.rbacService.updateRole(roleId, dto, userId);
  }

  @Patch(":id/permissions")
  @RequirePermissions("roles.manage")
  updateRolePermissions(
    @Param("id") roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser("userId") userId: string
  ) {
    return this.rbacService.updateRolePermissions(roleId, dto, userId);
  }
}
