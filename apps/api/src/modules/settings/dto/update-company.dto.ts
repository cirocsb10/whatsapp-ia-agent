import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateCompanyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(60)
  timezone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(60)
  segment?: string;
}
