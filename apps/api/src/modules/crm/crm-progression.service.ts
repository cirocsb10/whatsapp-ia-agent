import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class CrmProgressionService {
  private readonly logger = new Logger(CrmProgressionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async advanceToPosition(tenantId: string, contactId: string, targetPosition: number): Promise<void> {
    const deal = await this.prisma.deal.findFirst({
      where: { tenantId, contactId },
      include: { stage: true },
    });
    if (!deal) return;
    if (deal.stage.position >= targetPosition) return;

    const targetStage = await this.prisma.funnelStage.findFirst({
      where: { tenantId, position: targetPosition },
    });
    if (!targetStage) {
      this.logger.debug(`Stage at position ${targetPosition} not found for tenant ${tenantId}`);
      return;
    }

    await this.prisma.deal.update({ where: { id: deal.id }, data: { stageId: targetStage.id } });
    this.logger.log(`Deal ${deal.id} advanced to position ${targetPosition} ("${targetStage.name}")`);
  }

  async advanceToWon(tenantId: string, contactId: string): Promise<void> {
    const deal = await this.prisma.deal.findFirst({
      where: { tenantId, contactId },
      include: { stage: true },
    });
    if (!deal || deal.stage.isWon) return;

    const wonStage = await this.prisma.funnelStage.findFirst({ where: { tenantId, isWon: true } });
    if (!wonStage) {
      this.logger.debug(`No isWon stage for tenant ${tenantId}`);
      return;
    }

    await this.prisma.deal.update({
      where: { id: deal.id },
      data: { stageId: wonStage.id, closedAt: new Date() },
    });
    this.logger.log(`Deal ${deal.id} marked as Won`);
  }
}
