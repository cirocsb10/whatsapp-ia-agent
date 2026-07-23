import { Injectable, Logger } from "@nestjs/common";
import { CampaignRecipientStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

const STATUS_RANK: Record<CampaignRecipientStatus, number> = {
  PENDING: 0,
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  FAILED: 4,
  SKIPPED: 0,
};

export type CampaignDeliveryStatus = "sent" | "delivered" | "read" | "failed";

@Injectable()
export class CampaignStatusService {
  private readonly logger = new Logger(CampaignStatusService.name);

  constructor(private readonly prisma: PrismaService) {}

  mapMetaStatus(status: CampaignDeliveryStatus): CampaignRecipientStatus {
    switch (status) {
      case "sent":
        return "SENT";
      case "delivered":
        return "DELIVERED";
      case "read":
        return "READ";
      case "failed":
        return "FAILED";
      default: {
        const _exhaustive: never = status;
        void _exhaustive;
        return "FAILED";
      }
    }
  }

  async applyStatusUpdate(input: {
    tenantId: string;
    waMessageId: string;
    status: CampaignDeliveryStatus;
    timestamp: number;
    failureReason?: string;
  }): Promise<boolean> {
    const recipient = await this.prisma.campaignRecipient.findFirst({
      where: {
        waMessageId: input.waMessageId,
        campaign: { tenantId: input.tenantId },
      },
      select: { id: true, status: true },
    });

    if (!recipient) return false;

    const next = this.mapMetaStatus(input.status);
    const ts = new Date(input.timestamp * 1000);

    // Don't regress DELIVERED/READ back to SENT; FAILED always wins.
    if (
      next !== "FAILED" &&
      STATUS_RANK[recipient.status] > STATUS_RANK[next] &&
      recipient.status !== "FAILED"
    ) {
      return true;
    }

    const data: {
      status: CampaignRecipientStatus;
      sentAt?: Date;
      deliveredAt?: Date;
      readAt?: Date;
      failedAt?: Date;
      failureReason?: string | null;
    } = { status: next };

    switch (next) {
      case "SENT":
        data.sentAt = ts;
        break;
      case "DELIVERED":
        data.deliveredAt = ts;
        break;
      case "READ":
        data.readAt = ts;
        break;
      case "FAILED":
        data.failedAt = ts;
        data.failureReason = input.failureReason ?? "Meta delivery failed";
        break;
      case "PENDING":
      case "SKIPPED":
        break;
      default: {
        const _exhaustive: never = next;
        void _exhaustive;
      }
    }

    await this.prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data,
    });

    this.logger.debug(`Campaign recipient ${recipient.id} → ${next}`);
    return true;
  }
}
