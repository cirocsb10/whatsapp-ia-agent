import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { Prisma } from "@prisma/client";
import { UpdateWhatsappSettingsDto } from "./dto/update-whatsapp-settings.dto";

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async updateWhatsappSettings(tenantId: string, dto: UpdateWhatsappSettingsDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException("Tenant not found");

    const data: Pick<Prisma.TenantUpdateInput, "whatsappPhoneId" | "metaAccessToken"> = {
      whatsappPhoneId: dto.whatsappPhoneId,
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
}
