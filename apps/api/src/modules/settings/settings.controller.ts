import { Controller, Patch, Body, UseGuards } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { UpdateWhatsappSettingsDto } from "./dto/update-whatsapp-settings.dto";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";

@Controller("settings")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Patch("whatsapp")
  @Roles("OWNER", "ADMIN")
  updateWhatsapp(
    @CurrentTenantId() tenantId: string,
    @Body() dto: UpdateWhatsappSettingsDto,
  ) {
    return this.service.updateWhatsappSettings(tenantId, dto);
  }
}
