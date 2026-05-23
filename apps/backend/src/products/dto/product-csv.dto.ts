import { IsString } from "class-validator";

export class ImportProductsCsvDto {
  @IsString()
  csv!: string;
}
