import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CommissionRulesController } from "./commission-rules.controller";
import { CommissionRulesService } from "./commission-rules.service";

@Module({
  imports: [AuditModule],
  controllers: [CommissionRulesController],
  providers: [CommissionRulesService, PermissionsGuard]
})
export class CommissionRulesModule {}
