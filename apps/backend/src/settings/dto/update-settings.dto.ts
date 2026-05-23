import { IsArray, IsObject, IsOptional, IsString } from "class-validator";

export class UpdateSettingsDto {
  @IsOptional()
  @IsObject()
  companyProfile?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  requisites?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  documentNumbering?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  leadSources?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  orderStatuses?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  paymentMethods?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deliveryMethods?: string[];
}
