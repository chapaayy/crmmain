import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsQueryDto } from "./dto/analytics-query.dto";

@ApiTags("analytics")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("dashboard")
  @RequirePermissions("analytics.read")
  dashboard(@Query() query: AnalyticsQueryDto, @CurrentUser("userId") actorId: string) {
    return this.analyticsService.dashboard(query, actorId);
  }

  @Get("orders")
  @RequirePermissions("analytics.read")
  orders(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.orders(query);
  }

  @Get("sales")
  @RequirePermissions("analytics.read")
  sales(@Query() query: AnalyticsQueryDto, @CurrentUser("userId") actorId: string) {
    return this.analyticsService.sales(query, actorId);
  }

  @Get("products")
  @RequirePermissions("analytics.read")
  products(@Query() query: AnalyticsQueryDto, @CurrentUser("userId") actorId: string) {
    return this.analyticsService.products(query, actorId);
  }

  @Get("managers")
  @RequirePermissions("analytics.read")
  managers(@Query() query: AnalyticsQueryDto, @CurrentUser("userId") actorId: string) {
    return this.analyticsService.managers(query, actorId);
  }

  @Get("warehouse")
  @RequirePermissions("analytics.read")
  warehouse(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.warehouse(query);
  }
}
