import { Body, Controller, Get, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { PlatformSmtpSettingsService } from "./platform-smtp-settings.service";
import { TestSmtpSettingsDto, UpdateSmtpSettingsDto } from "./dto/smtp-settings.dto";

@Controller("super-admin/email")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class PlatformEmailController {
  constructor(private readonly smtpSettings: PlatformSmtpSettingsService) {}

  @Get("smtp")
  getSmtp() {
    return this.smtpSettings.getSettings();
  }

  @Put("smtp")
  updateSmtp(@Body() dto: UpdateSmtpSettingsDto) {
    return this.smtpSettings.updateSettings(dto);
  }

  @Post("smtp/test")
  testSmtp(@Body() dto: TestSmtpSettingsDto) {
    return this.smtpSettings.sendTestEmail(dto);
  }
}
