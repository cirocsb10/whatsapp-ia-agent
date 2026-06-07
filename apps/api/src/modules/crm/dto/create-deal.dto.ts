import { IsString, IsInt, IsOptional, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";

export class CreateDealDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  stageId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  valueCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  contactId?: string;
}

export class ListDealsDto {
  @IsOptional()
  @IsString()
  stageId?: string;
}
