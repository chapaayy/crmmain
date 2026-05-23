import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RbacService } from "./rbac.service";

@ApiTags("permissions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("permissions")
export class PermissionsController {
  constructor(private readonly rbacService: RbacService) {}

  @Get()
  @RequirePermissions("roles.read")
  listPermissions() {
    return this.rbacService.listPermissions();
  }
}
