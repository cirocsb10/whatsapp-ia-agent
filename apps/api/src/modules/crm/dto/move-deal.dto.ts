import { IsString } from "class-validator";

export class MoveDealDto {
  @IsString()
  stageId!: string;
}
