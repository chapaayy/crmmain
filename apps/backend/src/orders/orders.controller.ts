import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CreateCommentDto } from "../customers/dto/comment.dto";
import { CreateOrderDto, CreateOrderItemDto, UpdateOrderDto, UpdateOrderItemDto, UpdateOrderStatusDto } from "./dto/order.dto";
import { OrderQueryDto } from "./dto/order-query.dto";
import { OrdersService } from "./orders.service";

@ApiTags("orders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequirePermissions("orders.read")
  list(@Query() query: OrderQueryDto) {
    return this.ordersService.list(query);
  }

  @Post()
  @RequirePermissions("orders.create")
  create(@Body() dto: CreateOrderDto, @CurrentUser("userId") actorId: string) {
    return this.ordersService.create(dto, actorId);
  }

  @Get(":id")
  @RequirePermissions("orders.read")
  get(@Param("id") id: string) {
    return this.ordersService.get(id);
  }

  @Patch(":id")
  @RequirePermissions("orders.update")
  update(@Param("id") id: string, @Body() dto: UpdateOrderDto, @CurrentUser("userId") actorId: string) {
    return this.ordersService.update(id, dto, actorId);
  }

  @Delete(":id")
  @RequirePermissions("orders.update")
  delete(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.ordersService.delete(id, actorId);
  }

  @Post(":id/items")
  @RequirePermissions("orders.update")
  createItem(@Param("id") id: string, @Body() dto: CreateOrderItemDto, @CurrentUser("userId") actorId: string) {
    return this.ordersService.createItem(id, dto, actorId);
  }

  @Patch(":id/items/:itemId")
  @RequirePermissions("orders.update")
  updateItem(
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateOrderItemDto,
    @CurrentUser("userId") actorId: string
  ) {
    return this.ordersService.updateItem(id, itemId, dto, actorId);
  }

  @Delete(":id/items/:itemId")
  @RequirePermissions("orders.update")
  deleteItem(@Param("id") id: string, @Param("itemId") itemId: string, @CurrentUser("userId") actorId: string) {
    return this.ordersService.deleteItem(id, itemId, actorId);
  }

  @Patch(":id/status")
  @RequirePermissions("orders.change_status")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateOrderStatusDto, @CurrentUser("userId") actorId: string) {
    return this.ordersService.updateStatus(id, dto, actorId);
  }

  @Get(":id/status-history")
  @RequirePermissions("orders.read")
  statusHistory(@Param("id") id: string) {
    return this.ordersService.statusHistory(id);
  }

  @Post(":id/comments")
  @RequirePermissions("orders.update")
  addComment(@Param("id") id: string, @Body() dto: CreateCommentDto, @CurrentUser("userId") actorId: string) {
    return this.ordersService.addComment(id, dto, actorId);
  }
}
