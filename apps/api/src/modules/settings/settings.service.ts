import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

interface UpdateWhatsappSettingsDto {
  whatsappPhoneId: string;
  metaAccessToken?: string;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async updateWhatsappSettings(tenantId: string, dto: UpdateWhatsappSettingsDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException("Tenant not found");

    const data: Record<string, string> = { whatsappPhoneId: dto.whatsappPhoneId };
    if (dto.metaAccessToken) data["metaAccessToken"] = dto.metaAccessToken;

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: { id: true, whatsappPhoneId: true, whatsappStatus: true },
    });
  }
}
