import { TaskPriority, TaskStatus } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from "class-validator";

export class CreateEmployeeTaskDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  assigneeUserId?: string;

  @IsOptional()
  @IsString()
  assigneeEmployeeId?: string;

  @IsOptional()
  @IsString()
  assigneeDepartment?: string;

  @IsOptional()
  @IsString()
  responsibilityId?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}

export class UpdateEmployeeTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  assigneeUserId?: string | null;

  @IsOptional()
  @IsString()
  assigneeEmployeeId?: string | null;

  @IsOptional()
  @IsString()
  assigneeDepartment?: string | null;

  @IsOptional()
  @IsString()
  responsibilityId?: string | null;

  @IsOptional()
  @IsDateString()
  dueAt?: string | null;
}
