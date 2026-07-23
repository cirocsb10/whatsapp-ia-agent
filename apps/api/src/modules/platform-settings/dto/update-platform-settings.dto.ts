import { Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export class PlanConversationLimitsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  STARTER?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  GROWTH?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  SCALE?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ENTERPRISE?: number;
}

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional()
  @IsString()
  maintenanceMessage?: string | null;

  @IsOptional()
  @IsBoolean()
  newTenantRegistrationOpen?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  defaultTrialDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  defaultConversationsLimit?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PlanConversationLimitsDto)
  planConversationLimits?: PlanConversationLimitsDto;
}
