import { LeadStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { IsArray, IsDateString, IsEmail, IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateLeadDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interestedProducts?: string[];

  @IsOptional()
  @IsString()
  responsibleManagerId?: string;

  @IsOptional()
  @IsDateString()
  nextContactAt?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedValue?: number;
}

export class UpdateLeadDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interestedProducts?: string[];

  @IsOptional()
  @IsString()
  responsibleManagerId?: string;

  @IsOptional()
  @IsDateString()
  nextContactAt?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedValue?: number;
}
