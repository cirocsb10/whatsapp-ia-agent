import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { AudienceQuery } from "./campaign.constants";

@Injectable()
export class AudienceService {
  constructor(private readonly prisma: PrismaService) {}

  async buildAudience(tenantId: string, query: AudienceQuery) {
    if (query.type === "all") {
      return this.prisma.contact.findMany({
        where: { tenantId, isOptedOut: false },
        select: { id: true, phone: true, name: true },
      });
    }

    if (query.type === "crm_stage") {
      if (!query.stageId) {
        throw new BadRequestException("stageId é obrigatório para audiência crm_stage");
      }

      const stage = await this.prisma.funnelStage.findFirst({
        where: { id: query.stageId, tenantId },
        select: { id: true },
      });
      if (!stage) {
        throw new BadRequestException(`Estágio CRM ${query.stageId} não encontrado`);
      }

      const deals = await this.prisma.deal.findMany({
        where: { tenantId, stageId: query.stageId },
        select: { contactId: true },
      });
      const contactIds = [...new Set(deals.map((d) => d.contactId).filter(Boolean))] as string[];
      if (contactIds.length === 0) return [];

      return this.prisma.contact.findMany({
        where: { tenantId, isOptedOut: false, id: { in: contactIds } },
        select: { id: true, phone: true, name: true },
      });
    }

    const _exhaustive: never = query;
    void _exhaustive;
    throw new BadRequestException("audienceQuery inválido");
  }
}
