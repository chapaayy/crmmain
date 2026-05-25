import { CommissionSource } from "@prisma/client";
import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateCommissionRuleDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  roleId?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsEnum(CommissionSource)
  source?: CommissionSource;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  percent!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @IsString()
  productCategoryId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCommissionRuleDto {
  @IsOptional()
  @IsString()
  employeeId?: string | null;

  @IsOptional()
  @IsString()
  roleId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEnum(CommissionSource)
  source?: CommissionSource;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  percent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minOrderAmount?: number | null;

  @IsOptional()
  @IsString()
  productCategoryId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
