import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { AgentTone } from "@prisma/client";

export class UpdateAgentConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  agentName?: string;

  @IsOptional()
  @IsEnum(AgentTone)
  tone?: AgentTone;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  greetingMessage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  inactivityMessage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  closingMessage?: string;

  @IsOptional()
  @IsString()
  llmModel?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  @Type(() => Number)
  llmTemperature?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(4000)
  @Type(() => Number)
  maxResponseLength?: number;

  @IsOptional()
  @IsString()
  systemPromptBase?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
