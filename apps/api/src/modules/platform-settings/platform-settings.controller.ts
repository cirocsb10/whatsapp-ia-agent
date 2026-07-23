import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { UpdatePlatformSettingsDto } from "./dto/update-platform-settings.dto";
import { PlatformSettingsService } from "./platform-settings.service";

@Controller("super-admin/settings")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class PlatformSettingsController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get()
  getSettings() {
    return this.settings.getSettings();
  }

  @Put()
  updateSettings(@Body() dto: UpdatePlatformSettingsDto) {
    return this.settings.updateSettings(dto);
  }
}
