import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { GuardRuleAction, GuardRuleType } from "@prisma/client";

export class CreateGuardRuleDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(GuardRuleType)
  type!: GuardRuleType;

  @IsEnum(GuardRuleAction)
  action!: GuardRuleAction;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  priority?: number;

  @IsObject()
  config!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  fallbackMessage?: string;
}

export class UpdateGuardRuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(GuardRuleType)
  type?: GuardRuleType;

  @IsOptional()
  @IsEnum(GuardRuleAction)
  action?: GuardRuleAction;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  priority?: number;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  fallbackMessage?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
