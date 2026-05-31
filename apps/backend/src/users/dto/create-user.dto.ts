import { IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(["ru", "en"])
  locale?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(/^[A-Z][A-Z0-9_]{1,63}$/, { each: true, message: "Role codes must use uppercase latin letters, numbers, and underscores" })
  roleCodes?: string[];
}
