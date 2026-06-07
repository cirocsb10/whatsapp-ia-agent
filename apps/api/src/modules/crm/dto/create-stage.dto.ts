import { IsString, IsInt, IsOptional, IsBoolean, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";

export class CreateStageDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  color?: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  position!: number;

  @IsOptional()
  @IsBoolean()
  isWon?: boolean;

  @IsOptional()
  @IsBoolean()
  isLost?: boolean;
}
