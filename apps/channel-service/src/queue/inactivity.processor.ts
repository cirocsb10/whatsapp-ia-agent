import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { MessagingService } from "../messaging/messaging.service";
import { PrismaService } from "../prisma/prisma.service";
import { SessionService } from "../session/session.service";
import { CLOSE_GRACE_MINUTES, INACTIVITY_QUEUE } from "./queue.constants";
import { InactivityJobData } from "./inactivity.types";
import { InactivitySchedulerService } from "./inactivity-scheduler.service";

@Processor(INACTIVITY_QUEUE)
export class InactivityProcessor extends WorkerHost {
  private readonly logger = new Logger(InactivityProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagingService: MessagingService,
    private readonly scheduler: InactivitySchedulerService,
    private readonly sessionService: SessionService,
  ) {
    super();
  }

  async process(job: Job<InactivityJobData>): Promise<void> {
    const { conversationId, tenantId, contactPhone, waPhoneId, phase } = job.data;

    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId, status: "ACTIVE" },
      select: { lastMessageAt: true },
    });
    if (!conversation) {
      this.logger.debug(`Skipping inactivity job — conversation ${conversationId} not active`);
      return;
    }

    const lastMsgMs = conversation.lastMessageAt?.getTime() ?? 0;
    if (lastMsgMs > job.data.scheduledAt) {
      this.logger.debug(`Skipping inactivity job — new message since scheduled`);
      return;
    }

    const config = await this.prisma.agentConfig.findUnique({
      where: { tenantId },
      select: {
        inactivityMessage: true,
        closingMessage: true,
        inactivityTimeoutMin: true,
      },
    });

    if (phase === "warn") {
      await this.messagingService.sendMessage(waPhoneId, contactPhone, {
        type: "text",
        text: config?.inactivityMessage ?? "Ainda está por aqui?",
      });

      await this.scheduler.scheduleClose(
        job.data,
        CLOSE_GRACE_MINUTES * 60_000,
      );
      return;
    }

    await this.messagingService.sendMessage(waPhoneId, contactPhone, {
      type: "text",
      text: config?.closingMessage ?? "Foi um prazer atender você! Até logo.",
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: "CLOSED", closedAt: new Date() },
    });

    await this.sessionService.deleteSession(tenantId, contactPhone);
    this.logger.log(`Conversation ${conversationId} closed due to inactivity`);
  }
}
