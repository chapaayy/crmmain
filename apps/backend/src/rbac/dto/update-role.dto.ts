import { IsBoolean, IsOptional, IsString, Matches } from "class-validator";

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#([0-9A-Fa-f]{6})$/, { message: "Color must be a 6-digit HEX value" })
  color?: string;

  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;
}
