import { IsIn } from "class-validator";

export class UpdateCurrentUserPreferencesDto {
  @IsIn(["ru", "en"])
  locale!: string;
}
