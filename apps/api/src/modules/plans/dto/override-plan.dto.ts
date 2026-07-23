import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { PlanType } from "@prisma/client";

export class OverridePlanDto {
  @IsEnum(PlanType)
  planType!: PlanType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
