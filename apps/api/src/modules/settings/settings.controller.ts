import { Controller, Get, Patch, Body, UseGuards } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { UpdateWhatsappSettingsDto } from "./dto/update-whatsapp-settings.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentTenantId } from "../../common/decorators/current-tenant.decorator";

@Controller("settings")
@UseGuards(ClerkAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get("company")
  @Roles("OWNER", "ADMIN")
  getCompany(@CurrentTenantId() tenantId: string) {
    return this.service.getCompanySettings(tenantId);
  }

  @Patch("company")
  @Roles("OWNER", "ADMIN")
  updateCompany(
    @CurrentTenantId() tenantId: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.service.updateCompanySettings(tenantId, dto);
  }

  @Patch("whatsapp")
  @Roles("OWNER", "ADMIN")
  updateWhatsapp(
    @CurrentTenantId() tenantId: string,
    @Body() dto: UpdateWhatsappSettingsDto,
  ) {
    return this.service.updateWhatsappSettings(tenantId, dto);
  }

  @Get("notifications")
  @Roles("OWNER", "ADMIN")
  getNotifications(@CurrentTenantId() tenantId: string) {
    return this.service.getNotificationPrefs(tenantId);
  }

  @Patch("notifications")
  @Roles("OWNER", "ADMIN")
  updateNotifications(
    @CurrentTenantId() tenantId: string,
    @Body() body: Record<string, boolean>,
  ) {
    return this.service.updateNotificationPrefs(tenantId, body);
  }
}
