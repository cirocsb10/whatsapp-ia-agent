import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CrmAutoLeadService {
  private readonly logger = new Logger(CrmAutoLeadService.name);

  constructor(private readonly prisma: PrismaService) {}

  async maybeCreateLead(tenantId: string, contactId: string, phone: string, name?: string | null): Promise<void> {
    const existingDeals = await this.prisma.deal.count({ where: { tenantId, contactId } });
    if (existingDeals > 0) return;

    const firstStage = await this.prisma.funnelStage.findFirst({
      where: { tenantId },
      orderBy: { position: "asc" },
    });
    if (!firstStage) {
      this.logger.debug(`No funnel stages for tenant ${tenantId} — skipping auto-lead`);
      return;
    }

    await this.prisma.deal.create({
      data: { tenantId, stageId: firstStage.id, contactId, title: name ?? phone, valueCents: 0 },
    });
    this.logger.log(`Auto-lead created for contact ${phone} → stage "${firstStage.name}"`);
  }

  async advanceToLost(tenantId: string, contactId: string): Promise<void> {
    const deal = await this.prisma.deal.findFirst({ where: { tenantId, contactId } });
    if (!deal) return;

    const lostStage = await this.prisma.funnelStage.findFirst({ where: { tenantId, isLost: true } });
    if (!lostStage) {
      this.logger.debug(`No isLost stage for tenant ${tenantId} — skipping opt-out advance`);
      return;
    }

    await this.prisma.deal.update({
      where: { id: deal.id },
      data: { stageId: lostStage.id, closedAt: new Date() },
    });
    this.logger.log(`Deal ${deal.id} marked as Lost (opt-out)`);
  }
}
