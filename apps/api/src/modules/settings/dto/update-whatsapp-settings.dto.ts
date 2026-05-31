import { IsString, IsOptional, IsNotEmpty } from "class-validator";

export class UpdateWhatsappSettingsDto {
  @IsString()
  @IsNotEmpty()
  whatsappPhoneId!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  metaAccessToken?: string;
}
