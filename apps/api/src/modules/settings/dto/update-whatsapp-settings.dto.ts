import { IsString, IsOptional, IsNotEmpty, MinLength } from "class-validator";

export class UpdateWhatsappSettingsDto {
  @IsString()
  @IsNotEmpty()
  whatsappPhoneId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  metaAccessToken?: string;
}
