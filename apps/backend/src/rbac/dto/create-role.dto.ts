import { RoleCode } from "@prisma/client";
import { IsBoolean, IsEnum, IsOptional, IsString, Matches } from "class-validator";

export class CreateRoleDto {
  @IsEnum(RoleCode)
  code!: RoleCode;

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
