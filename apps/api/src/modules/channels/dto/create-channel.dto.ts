import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  MaxLength,
  MinLength,
  ArrayUnique,
} from "class-validator";

export class CreateChannelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  whatsappPhoneId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  whatsappNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  metaAccessToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  wabaId?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  memberUserIds?: string[];

  @IsOptional()
  @IsBoolean()
  isAiEnabled?: boolean;
}
