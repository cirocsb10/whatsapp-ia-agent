import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { Prisma } from "@prisma/client";
import { UpdateWhatsappSettingsDto } from "./dto/update-whatsapp-settings.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";

const DEFAULT_NOTIFICATION_PREFS = {
  newMessage: true,
  handoffPending: true,
  orderCreated: true,
  paymentConfirmed: true,
  weeklyReport: false,
  productUpdates: false,
};

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getCompanySettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        segment: true,
        whatsappStatus: true,
        whatsappPhoneId: true,
      },
    });
    if (!tenant) throw new NotFoundException("Tenant not found");
    return tenant;
  }

  async updateCompanySettings(tenantId: string, dto: UpdateCompanyDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException("Tenant not found");

    const data: Pick<Prisma.TenantUpdateInput, "name" | "timezone" | "segment"> = {
      name: dto.name,
    };
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.segment !== undefined) data.segment = dto.segment;

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        segment: true,
        whatsappStatus: true,
        whatsappPhoneId: true,
      },
    });
  }

  async updateWhatsappSettings(tenantId: string, dto: UpdateWhatsappSettingsDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException("Tenant not found");

    const data: Pick<Prisma.TenantUpdateInput, "whatsappPhoneId" | "metaAccessToken" | "whatsappStatus"> = {
      whatsappPhoneId: dto.whatsappPhoneId,
      whatsappStatus: dto.whatsappPhoneId ? "CONNECTED" : "DISCONNECTED",
    };
    if (dto.metaAccessToken !== undefined) data.metaAccessToken = dto.metaAccessToken;

    const result = await this.prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: { id: true, whatsappPhoneId: true, whatsappStatus: true },
    });

    this.logger.log(`WhatsApp settings updated for tenant ${tenantId}: phoneId=${dto.whatsappPhoneId}`);
    return result;
  }

  async getNotificationPrefs(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { notificationPrefs: true },
    });
    const saved =
      typeof tenant?.notificationPrefs === "object" && tenant.notificationPrefs !== null
        ? (tenant.notificationPrefs as Record<string, boolean>)
        : {};
    return { ...DEFAULT_NOTIFICATION_PREFS, ...saved };
  }

  async updateNotificationPrefs(tenantId: string, prefs: Record<string, boolean>) {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { notificationPrefs: prefs },
    });
    return prefs;
  }
}
