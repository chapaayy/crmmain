import { ResponsibilityAssignmentRole, ResponsibilityInstructionFormat, ResponsibilityStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateResponsibilityDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEnum(ResponsibilityStatus)
  status?: ResponsibilityStatus;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  ownerEmployeeId?: string;
}

export class UpdateResponsibilityDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  @IsEnum(ResponsibilityStatus)
  status?: ResponsibilityStatus;

  @IsOptional()
  @IsString()
  ownerUserId?: string | null;

  @IsOptional()
  @IsString()
  ownerEmployeeId?: string | null;
}

export class AssignResponsibilityDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEnum(ResponsibilityAssignmentRole)
  role?: ResponsibilityAssignmentRole;
}

export class CreateResponsibilityInstructionDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  content!: string;

  @IsOptional()
  @IsEnum(ResponsibilityInstructionFormat)
  format?: ResponsibilityInstructionFormat;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateResponsibilityInstructionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string;

  @IsOptional()
  @IsEnum(ResponsibilityInstructionFormat)
  format?: ResponsibilityInstructionFormat;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateResponsibilityChecklistItemDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

export class UpdateResponsibilityChecklistItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}
