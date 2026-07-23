import { Type } from "class-transformer";
import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { AudienceQueryDto } from "./audience-query.dto";

export class CreateCampaignDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsUUID()
  channelId!: string;

  @IsUUID()
  templateId!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => AudienceQueryDto)
  audienceQuery!: AudienceQueryDto;

  @IsOptional()
  @IsString()
  scheduledAt?: string;
}
