import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { PermissionsController } from "./permissions.controller";
import { RbacService } from "./rbac.service";
import { RolesController } from "./roles.controller";

@Module({
  imports: [AuditModule],
  controllers: [RolesController, PermissionsController],
  providers: [RbacService, PermissionsGuard],
  exports: [RbacService, PermissionsGuard]
})
export class RbacModule {}
