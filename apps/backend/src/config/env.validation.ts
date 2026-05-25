import { plainToInstance, Transform } from "class-transformer";
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, Min, validateSync } from "class-validator";

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGINS!: string;

  @IsUrl({ require_tld: false })
  API_PUBLIC_URL!: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_EXPIRES_IN?: string;

  @IsOptional()
  @IsString()
  JWT_REFRESH_EXPIRES_IN?: string;

  @IsOptional()
  @IsString()
  REFRESH_TOKEN_COOKIE_NAME?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === "" ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  PORT?: number;

  @IsOptional()
  @IsString()
  NODE_ENV?: string;

  @IsOptional()
  @IsString()
  UPLOADS_DIR?: string;

  @IsOptional()
  @IsString()
  PAYROLL_CURRENCY?: string;

  @IsOptional()
  @IsString()
  PAYROLL_TIMEZONE?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === "" ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  PAYROLL_DEFAULT_WORKDAY_HOURS?: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === "" ? undefined : Number(value)))
  @IsNumber()
  @Min(0)
  PAYROLL_OVERTIME_MULTIPLIER?: number;

  @IsOptional()
  @IsString()
  PAYROLL_ENABLE_SALES_COMMISSION?: string;

  @IsOptional()
  @IsString()
  PAYROLL_ENABLE_ATTENDANCE?: string;

  @IsOptional()
  @IsString()
  COMPANY_NAME?: string;

  @IsOptional()
  @IsString()
  COMPANY_SHORT_NAME?: string;

  @IsOptional()
  @IsString()
  COMPANY_PHONE?: string;

  @IsOptional()
  @IsString()
  COMPANY_EMAIL?: string;

  @IsOptional()
  @IsString()
  COMPANY_WEBSITE?: string;

  @IsOptional()
  @IsString()
  COMPANY_ADDRESS?: string;

  @IsOptional()
  @IsString()
  COMPANY_INN?: string;

  @IsOptional()
  @IsString()
  COMPANY_KPP?: string;

  @IsOptional()
  @IsString()
  COMPANY_OGRN?: string;

  @IsOptional()
  @IsString()
  COMPANY_BANK_NAME?: string;

  @IsOptional()
  @IsString()
  COMPANY_BIK?: string;

  @IsOptional()
  @IsString()
  COMPANY_ACCOUNT?: string;

  @IsOptional()
  @IsString()
  COMPANY_CORRESPONDENT_ACCOUNT?: string;
}

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true
  });
  const errors = validateSync(validated, {
    skipMissingProperties: false
  });

  if (errors.length > 0) {
    const messages = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .join("; ");

    throw new Error(`Environment validation failed: ${messages}`);
  }

  return validated as unknown as Record<string, unknown>;
}
