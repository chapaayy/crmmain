import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CommissionRulesService } from "./commission-rules.service";
import { CreateCommissionRuleDto, UpdateCommissionRuleDto } from "./dto/commission-rule.dto";
import { CommissionRuleQueryDto } from "./dto/commission-rule-query.dto";

@ApiTags("commission-rules")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("commission-rules")
export class CommissionRulesController {
  constructor(private readonly commissionRulesService: CommissionRulesService) {}

  @Get()
  @RequirePermissions("salary_rules.read")
  list(@Query() query: CommissionRuleQueryDto) {
    return this.commissionRulesService.list(query);
  }

  @Post()
  @RequirePermissions("salary_rules.manage")
  create(@Body() dto: CreateCommissionRuleDto, @CurrentUser("userId") actorId: string) {
    return this.commissionRulesService.create(dto, actorId);
  }

  @Patch(":id")
  @RequirePermissions("salary_rules.manage")
  update(@Param("id") id: string, @Body() dto: UpdateCommissionRuleDto, @CurrentUser("userId") actorId: string) {
    return this.commissionRulesService.update(id, dto, actorId);
  }

  @Delete(":id")
  @RequirePermissions("salary_rules.manage")
  delete(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.commissionRulesService.delete(id, actorId);
  }
}
