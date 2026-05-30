import { TaskPriority, TaskRelatedType, TaskStatus } from "@prisma/client";
import { IsDateString, IsEnum, IsIn, IsOptional, IsString, MinLength } from "class-validator";

const supportedTaskRelatedTypes = [TaskRelatedType.PRODUCT];

export class CreateTaskDto {
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
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  creatorId?: string;

  @IsOptional()
  @IsIn(supportedTaskRelatedTypes)
  relatedType?: TaskRelatedType;

  @IsOptional()
  @IsString()
  relatedId?: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

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
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsIn(supportedTaskRelatedTypes)
  relatedType?: TaskRelatedType;

  @IsOptional()
  @IsString()
  relatedId?: string;
}

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus)
  status!: TaskStatus;
}
