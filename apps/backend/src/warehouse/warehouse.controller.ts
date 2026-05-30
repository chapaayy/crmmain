import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { StockAdjustDto, StockReceiptDto, StockWriteoffDto } from "./dto/stock-operation.dto";
import { StockMovementQueryDto, StockQueryDto } from "./dto/warehouse-query.dto";
import { WarehouseService } from "./warehouse.service";

@ApiTags("warehouse")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("warehouse")
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get("stock")
  @RequirePermissions("warehouse.read")
  stock(@Query() query: StockQueryDto) {
    return this.warehouseService.stock(query);
  }

  @Get("movements")
  @RequirePermissions("warehouse.read")
  movements(@Query() query: StockMovementQueryDto) {
    return this.warehouseService.movements(query);
  }

  @Post("receipt")
  @RequirePermissions("warehouse.manage")
  receipt(@Body() dto: StockReceiptDto, @CurrentUser("userId") actorId: string) {
    return this.warehouseService.receipt(dto, actorId);
  }

  @Post("adjust")
  @RequirePermissions("warehouse.manage")
  adjust(@Body() dto: StockAdjustDto, @CurrentUser("userId") actorId: string) {
    return this.warehouseService.adjust(dto, actorId);
  }

  @Post("writeoff")
  @RequirePermissions("warehouse.manage")
  writeoff(@Body() dto: StockWriteoffDto, @CurrentUser("userId") actorId: string) {
    return this.warehouseService.writeoff(dto, actorId);
  }
}
