import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  CAMPAIGN_DISPATCH_QUEUE,
  META_GRAPH_API,
} from "./campaign.constants";
import type { CampaignDispatchJobData } from "./campaigns.service";

@Processor(CAMPAIGN_DISPATCH_QUEUE)
export class CampaignDispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignDispatchProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<CampaignDispatchJobData>): Promise<void> {
    const { campaignId, tenantId } = job.data;
    this.logger.log(`Dispatching campaign ${campaignId}`);

    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
      include: {
        template: true,
        channel: true,
        recipients: {
          where: { status: "PENDING" },
          include: { contact: { select: { id: true, phone: true, isOptedOut: true } } },
        },
      },
    });

    if (!campaign) {
      this.logger.warn(`Campaign ${campaignId} not found — skipping`);
      return;
    }

    if (campaign.template.status !== "APPROVED") {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "FAILED", completedAt: new Date() },
      });
      throw new Error(`Template not APPROVED: ${campaign.template.status}`);
    }

    const token = campaign.channel.metaAccessToken?.trim();
    const phoneId = campaign.channel.whatsappPhoneId;
    if (!token || !phoneId) {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "FAILED", completedAt: new Date() },
      });
      throw new Error("Channel missing Meta credentials");
    }

    let failed = 0;
    for (const recipient of campaign.recipients) {
      if (recipient.contact.isOptedOut) {
        await this.prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "SKIPPED",
            failureReason: "Contact opted out",
            failedAt: new Date(),
          },
        });
        continue;
      }

      try {
        const waMessageId = await this.sendTemplate({
          phoneId,
          token,
          to: recipient.contact.phone,
          templateName: campaign.template.name,
          language: campaign.template.language,
        });

        await this.prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "SENT",
            waMessageId,
            sentAt: new Date(),
          },
        });
      } catch (err) {
        failed += 1;
        const reason = err instanceof Error ? err.message : "Send failed";
        this.logger.warn(`Recipient ${recipient.id} failed: ${reason}`);
        await this.prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "FAILED",
            failedAt: new Date(),
            failureReason: reason.slice(0, 500),
          },
        });
      }
    }

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: failed > 0 && failed === campaign.recipients.length ? "FAILED" : "COMPLETED",
        completedAt: new Date(),
      },
    });

    this.logger.log(
      `Campaign ${campaignId} done — ${campaign.recipients.length - failed} sent, ${failed} failed`,
    );
  }

  private async sendTemplate(input: {
    phoneId: string;
    token: string;
    to: string;
    templateName: string;
    language: string;
  }): Promise<string> {
    const res = await fetch(`${META_GRAPH_API}/${input.phoneId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.to,
        type: "template",
        template: {
          name: input.templateName,
          language: { code: input.language },
        },
      }),
    });

    const json = (await res.json()) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    };

    if (!res.ok) {
      throw new Error(json.error?.message ?? `Meta HTTP ${res.status}`);
    }

    const waMessageId = json.messages?.[0]?.id;
    if (!waMessageId) throw new Error("Meta response missing message id");
    return waMessageId;
  }
}
