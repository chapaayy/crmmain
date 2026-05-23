import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CreateOrderPaymentDto, CreatePaymentDto, UpdatePaymentDto } from "./dto/payment.dto";
import { PaymentQueryDto } from "./dto/payment-query.dto";
import { PaymentsService } from "./payments.service";

@ApiTags("payments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get("payments")
  @RequirePermissions("payments.read")
  list(@Query() query: PaymentQueryDto) {
    return this.paymentsService.list(query);
  }

  @Post("payments")
  @RequirePermissions("payments.manage")
  create(@Body() dto: CreatePaymentDto, @CurrentUser("userId") actorId: string) {
    return this.paymentsService.create(dto, actorId);
  }

  @Get("payments/:id")
  @RequirePermissions("payments.read")
  get(@Param("id") id: string) {
    return this.paymentsService.get(id);
  }

  @Patch("payments/:id")
  @RequirePermissions("payments.manage")
  update(@Param("id") id: string, @Body() dto: UpdatePaymentDto, @CurrentUser("userId") actorId: string) {
    return this.paymentsService.update(id, dto, actorId);
  }

  @Delete("payments/:id")
  @RequirePermissions("payments.manage")
  delete(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.paymentsService.delete(id, actorId);
  }

  @Get("orders/:id/payments")
  @RequirePermissions("payments.read")
  listForOrder(@Param("id") id: string) {
    return this.paymentsService.listForOrder(id);
  }

  @Post("orders/:id/payments")
  @RequirePermissions("payments.manage")
  createForOrder(@Param("id") id: string, @Body() dto: CreateOrderPaymentDto, @CurrentUser("userId") actorId: string) {
    return this.paymentsService.createForOrder(id, dto, actorId);
  }
}
