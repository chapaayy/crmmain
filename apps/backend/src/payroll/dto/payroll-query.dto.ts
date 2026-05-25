import { PayrollPeriodStatus, PayrollRunStatus } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class PayrollPeriodQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(PayrollPeriodStatus)
  status?: PayrollPeriodStatus;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class PayrollRunQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  periodId?: string;

  @IsOptional()
  @IsEnum(PayrollRunStatus)
  status?: PayrollRunStatus;
}

export class PayrollAdjustmentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  periodId?: string;
}
