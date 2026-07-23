import { IsBoolean } from "class-validator";

export class ToggleAiDto {
  @IsBoolean()
  enabled!: boolean;
}
