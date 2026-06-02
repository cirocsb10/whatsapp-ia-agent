import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateKnowledgeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsIn(["TEXT", "URL", "FILE"])
  type!: string;

  @IsString()
  @MinLength(1)
  content!: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;
}
