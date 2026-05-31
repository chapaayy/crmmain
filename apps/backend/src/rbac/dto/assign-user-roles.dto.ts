import { ArrayNotEmpty, IsArray, IsOptional, IsString, Matches } from "class-validator";

export class AssignUserRolesDto {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roleIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @Matches(/^[A-Z][A-Z0-9_]{1,63}$/, { each: true, message: "Role codes must use uppercase latin letters, numbers, and underscores" })
  roleCodes?: string[];
}
