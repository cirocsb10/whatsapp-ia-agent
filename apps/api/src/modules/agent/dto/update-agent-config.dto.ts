import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
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

  // ── Atendimento & Handoff ───────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(500)
  outOfHoursMessage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  handoffMessage?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  autoHandoffThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  handoffOrderValueBrl?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  @Type(() => Number)
  inactivityTimeoutMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  @Type(() => Number)
  sessionTtlHours?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(500)
  @Type(() => Number)
  maxConversationLength?: number;

  // ── Horário de funcionamento ────────────────────────────
  @IsOptional()
  @IsObject()
  businessHours?: Record<string, { enabled: boolean; start: string; end: string }>;

  // ── LLM Config ─────────────────────────────────────────
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
  @MaxLength(5000)
  systemPromptBase?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
