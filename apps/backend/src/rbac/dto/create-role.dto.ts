import { IsBoolean, IsOptional, IsString, Matches } from "class-validator";

export class CreateRoleDto {
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{1,63}$/, { message: "Code must use uppercase latin letters, numbers, and underscores" })
  code!: string;

  @IsString()
  name!: string;

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
