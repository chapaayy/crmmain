import { TimeEntrySource, TimeEntryStatus, WorkShiftStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateWorkShiftDto {
  @IsString()
  @MinLength(1)
  employeeId!: string;

  @IsOptional()
  @IsString()
  scheduleId?: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsDateString()
  plannedStart?: string;

  @IsOptional()
  @IsDateString()
  plannedEnd?: string;

  @IsOptional()
  @IsDateString()
  actualStart?: string;

  @IsOptional()
  @IsDateString()
  actualEnd?: string;

  @IsOptional()
  @IsEnum(WorkShiftStatus)
  status?: WorkShiftStatus;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class UpdateWorkShiftDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  scheduleId?: string | null;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsDateString()
  plannedStart?: string | null;

  @IsOptional()
  @IsDateString()
  plannedEnd?: string | null;

  @IsOptional()
  @IsDateString()
  actualStart?: string | null;

  @IsOptional()
  @IsDateString()
  actualEnd?: string | null;

  @IsOptional()
  @IsEnum(WorkShiftStatus)
  status?: WorkShiftStatus;

  @IsOptional()
  @IsString()
  comment?: string | null;
}

export class CreateTimeEntryDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsDateString()
  date!: string;

  @IsDateString()
  startedAt!: string;

  @IsOptional()
  @IsDateString()
  endedAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  breakMinutes?: number;

  @IsOptional()
  @IsEnum(TimeEntrySource)
  source?: TimeEntrySource;

  @IsOptional()
  @IsEnum(TimeEntryStatus)
  status?: TimeEntryStatus;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class UpdateTimeEntryDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  endedAt?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  breakMinutes?: number;

  @IsOptional()
  @IsEnum(TimeEntrySource)
  source?: TimeEntrySource;

  @IsOptional()
  @IsEnum(TimeEntryStatus)
  status?: TimeEntryStatus;

  @IsOptional()
  @IsString()
  comment?: string | null;
}

export class RejectTimeEntryDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
