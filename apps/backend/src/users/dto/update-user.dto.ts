import { IsBoolean, IsEmail, IsIn, IsOptional, IsString } from "class-validator";

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;

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
}
