import { Type } from "class-transformer";
import { IsArray, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from "class-validator";

export class StockLineDto {
  @IsString()
  @MinLength(1)
  productVariantId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class StockReceiptDto extends StockLineDto {
  @IsString()
  @MinLength(1)
  warehouseId!: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class StockAdjustDto {
  @IsString()
  @MinLength(1)
  warehouseId!: string;

  @IsString()
  @MinLength(1)
  productVariantId!: string;

  @Type(() => Number)
  @IsNumber()
  quantityDelta!: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class StockWriteoffDto extends StockReceiptDto {}

export class OrderStockOperationDto {
  @IsString()
  @MinLength(1)
  orderId!: string;

  @IsString()
  @MinLength(1)
  warehouseId!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockLineDto)
  items?: StockLineDto[];

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
