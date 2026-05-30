import { IsObject, IsOptional } from "class-validator";

export class UpdateSettingsDto {
  @IsOptional()
  @IsObject()
  companyProfile?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  requisites?: Record<string, unknown>;

}
