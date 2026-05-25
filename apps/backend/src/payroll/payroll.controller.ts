import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CreatePayrollAdjustmentDto, CreatePayrollPeriodDto, CreatePayrollRunDto, UpdatePayrollAdjustmentDto, UpdatePayrollPeriodDto } from "./dto/payroll.dto";
import { PayrollAdjustmentQueryDto, PayrollPeriodQueryDto, PayrollRunQueryDto } from "./dto/payroll-query.dto";
import { PayrollService } from "./payroll.service";

@ApiTags("payroll")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("payroll")
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get("periods")
  @RequirePermissions("payroll.read")
  listPeriods(@Query() query: PayrollPeriodQueryDto) {
    return this.payrollService.listPeriods(query);
  }

  @Post("periods")
  @RequirePermissions("payroll.manage")
  createPeriod(@Body() dto: CreatePayrollPeriodDto, @CurrentUser("userId") actorId: string) {
    return this.payrollService.createPeriod(dto, actorId);
  }

  @Patch("periods/:id")
  @RequirePermissions("payroll.manage")
  updatePeriod(@Param("id") id: string, @Body() dto: UpdatePayrollPeriodDto, @CurrentUser("userId") actorId: string) {
    return this.payrollService.updatePeriod(id, dto, actorId);
  }

  @Get("runs")
  @RequirePermissions("payroll.read")
  listRuns(@Query() query: PayrollRunQueryDto) {
    return this.payrollService.listRuns(query);
  }

  @Post("runs")
  @RequirePermissions("payroll.manage")
  createRun(@Body() dto: CreatePayrollRunDto, @CurrentUser("userId") actorId: string) {
    return this.payrollService.createRun(dto, actorId);
  }

  @Get("runs/:id")
  @RequirePermissions("payroll.read")
  getRun(@Param("id") id: string) {
    return this.payrollService.getRun(id);
  }

  @Post("runs/:id/calculate")
  @RequirePermissions("payroll.manage")
  calculateRun(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.payrollService.calculateRun(id, actorId);
  }

  @Post("runs/:id/approve")
  @RequirePermissions("payroll.approve")
  approveRun(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.payrollService.approveRun(id, actorId);
  }

  @Post("runs/:id/mark-paid")
  @RequirePermissions("payroll.manage")
  markRunPaid(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.payrollService.markRunPaid(id, actorId);
  }

  @Post("runs/:id/cancel")
  @RequirePermissions("payroll.manage")
  cancelRun(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.payrollService.cancelRun(id, actorId);
  }

  @Get("runs/:id/export")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @RequirePermissions("payroll.export")
  async exportRun(@Param("id") id: string, @CurrentUser("userId") actorId: string, @Res({ passthrough: true }) response: Response) {
    response.setHeader("Content-Disposition", `attachment; filename="payroll-${id}.csv"`);
    return this.payrollService.exportRun(id, actorId);
  }

  @Get("adjustments")
  @RequirePermissions("payroll.read")
  listAdjustments(@Query() query: PayrollAdjustmentQueryDto) {
    return this.payrollService.listAdjustments(query);
  }

  @Post("adjustments")
  @RequirePermissions("payroll.manage")
  createAdjustment(@Body() dto: CreatePayrollAdjustmentDto, @CurrentUser("userId") actorId: string) {
    return this.payrollService.createAdjustment(dto, actorId);
  }

  @Patch("adjustments/:id")
  @RequirePermissions("payroll.manage")
  updateAdjustment(@Param("id") id: string, @Body() dto: UpdatePayrollAdjustmentDto, @CurrentUser("userId") actorId: string) {
    return this.payrollService.updateAdjustment(id, dto, actorId);
  }

  @Delete("adjustments/:id")
  @RequirePermissions("payroll.manage")
  deleteAdjustment(@Param("id") id: string, @CurrentUser("userId") actorId: string) {
    return this.payrollService.deleteAdjustment(id, actorId);
  }
}
