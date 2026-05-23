import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CreateWarehouseDto, UpdateWarehouseDto } from "./dto/warehouse.dto";
import { WarehouseService } from "./warehouse.service";

@ApiTags("warehouses")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("warehouses")
export class WarehousesController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get()
  @RequirePermissions("warehouse.read")
  listWarehouses() {
    return this.warehouseService.listWarehouses();
  }

  @Post()
  @RequirePermissions("warehouse.manage")
  createWarehouse(@Body() dto: CreateWarehouseDto, @CurrentUser("userId") actorId: string) {
    return this.warehouseService.createWarehouse(dto, actorId);
  }

  @Patch(":id")
  @RequirePermissions("warehouse.manage")
  updateWarehouse(@Param("id") id: string, @Body() dto: UpdateWarehouseDto, @CurrentUser("userId") actorId: string) {
    return this.warehouseService.updateWarehouse(id, dto, actorId);
  }

  @Delete(":id")
  @RequirePermissions("warehouse.manage")
  deleteWarehouse(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.warehouseService.deleteWarehouse(id, actorId);
  }
}
