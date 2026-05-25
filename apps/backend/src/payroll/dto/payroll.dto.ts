import { PayrollAdjustmentType, PayrollPeriodStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, MinLength } from "class-validator";

export class CreatePayrollPeriodDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;

  @IsOptional()
  @IsEnum(PayrollPeriodStatus)
  status?: PayrollPeriodStatus;
}

export class UpdatePayrollPeriodDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsEnum(PayrollPeriodStatus)
  status?: PayrollPeriodStatus;
}

export class CreatePayrollRunDto {
  @IsString()
  @MinLength(1)
  periodId!: string;
}

export class CreatePayrollAdjustmentDto {
  @IsString()
  @MinLength(1)
  employeeId!: string;

  @IsString()
  @MinLength(1)
  periodId!: string;

  @IsEnum(PayrollAdjustmentType)
  type!: PayrollAdjustmentType;

  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @IsString()
  @MinLength(1)
  reason!: string;
}

export class UpdatePayrollAdjustmentDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  periodId?: string;

  @IsOptional()
  @IsEnum(PayrollAdjustmentType)
  type?: PayrollAdjustmentType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  reason?: string;
}
