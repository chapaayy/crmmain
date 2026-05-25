import { SecretVaultItemType } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export class SecretVaultItemQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(SecretVaultItemType)
  type?: SecretVaultItemType;

  @IsOptional()
  @IsString()
  responsibilityId?: string;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  ownerEmployeeId?: string;
}
