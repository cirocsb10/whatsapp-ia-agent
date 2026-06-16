import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { GuardRuleAction, GuardRuleType } from "@prisma/client";

@ValidatorConstraint({ name: "GuardRuleConfigConstraint", async: false })
class GuardRuleConfigConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;

    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 20) return false;

    return entries.every(([, entryValue]) => {
      if (Array.isArray(entryValue)) {
        return entryValue.length <= 200 && entryValue.every((item) => typeof item === "string" || typeof item === "number");
      }
      const type = typeof entryValue;
      return type === "string" || type === "number" || type === "boolean";
    });
  }

  defaultMessage(): string {
    return "config must contain at most 20 properties with primitive or array-of-primitives values";
  }
}

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
  @Validate(GuardRuleConfigConstraint)
  config!: Record<string, string | number | boolean | (string | number)[]>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

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
  @Validate(GuardRuleConfigConstraint)
  config?: Record<string, string | number | boolean | (string | number)[]>;

  @IsOptional()
  @IsString()
  fallbackMessage?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
