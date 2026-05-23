import { BagBottomType, BagTopType, BagType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateProductVariantDto {
  @IsString()
  @MinLength(1)
  sku!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  categoryId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  density?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  material?: string;

  @IsOptional()
  @IsEnum(BagType)
  bagType?: BagType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsString()
  capacity?: string;

  @IsOptional()
  @IsBoolean()
  hasLiner?: boolean;

  @IsOptional()
  @IsBoolean()
  hasHandles?: boolean;

  @IsOptional()
  @IsEnum(BagTopType)
  topType?: BagTopType;

  @IsOptional()
  @IsEnum(BagBottomType)
  bottomType?: BagBottomType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minOrderQty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  packageQty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  retailPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  wholesalePrice?: number;

  @IsOptional()
  @IsBoolean()
  isCustomOrderAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProductVariantDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  sku?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  categoryId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  density?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  material?: string;

  @IsOptional()
  @IsEnum(BagType)
  bagType?: BagType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsString()
  capacity?: string;

  @IsOptional()
  @IsBoolean()
  hasLiner?: boolean;

  @IsOptional()
  @IsBoolean()
  hasHandles?: boolean;

  @IsOptional()
  @IsEnum(BagTopType)
  topType?: BagTopType;

  @IsOptional()
  @IsEnum(BagBottomType)
  bottomType?: BagBottomType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minOrderQty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  packageQty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  retailPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  wholesalePrice?: number;

  @IsOptional()
  @IsBoolean()
  isCustomOrderAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
