import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  MaxLength,
  MinLength,
} from "class-validator";

export enum ChannelStatusDto {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}

export class UpdateChannelDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  whatsappPhoneId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  whatsappNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  metaAccessToken?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  wabaId?: string | null;

  @IsOptional()
  @IsEnum(ChannelStatusDto)
  status?: ChannelStatusDto;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isAiEnabled?: boolean;
}
