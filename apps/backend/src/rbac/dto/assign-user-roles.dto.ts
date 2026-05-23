import { RoleCode } from "@prisma/client";
import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString } from "class-validator";

export class AssignUserRolesDto {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roleIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(RoleCode, { each: true })
  roleCodes?: RoleCode[];
}
