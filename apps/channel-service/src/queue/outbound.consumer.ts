import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqplib from "amqplib";
import { MessagingService } from "../messaging/messaging.service";
import { PrismaService } from "../prisma/prisma.service";
import { InboundProducer } from "./inbound.producer";
import { InactivitySchedulerService } from "./inactivity-scheduler.service";

@Injectable()
export class OutboundConsumer implements OnModuleInit {
  private readonly logger = new Logger(OutboundConsumer.name);

  constructor(
    private readonly config: ConfigService,
    private readonly messaging: MessagingService,
    private readonly prisma: PrismaService,
    private readonly inbound: InboundProducer,
    private readonly inactivityScheduler: InactivitySchedulerService,
  ) {}

  async handleOutboundMessage(event: {
    tenantId?: string;
    conversationId?: string;
    waPhoneId: string;
    toPhone: string;
    inactivityTimeoutMin?: number;
    messages: Array<{ type: string; text?: string; imageUrl?: string }>;
  }): Promise<void> {
    for (const m of event.messages) {
      const waMessageId = await this.messaging.sendMessage(event.waPhoneId, event.toPhone, {
        type: m.type as "text" | "image" | "template",
        ...(m.text !== undefined && { text: m.text }),
        ...(m.imageUrl !== undefined && { imageUrl: m.imageUrl }),
      });

      if (event.tenantId && event.conversationId) {
        try {
          const sentAt = new Date();
          const saved = await this.prisma.message.create({
            data: {
              tenantId: event.tenantId,
              conversationId: event.conversationId,
              direction: "OUTBOUND",
              type: m.type.toUpperCase() as any,
              ...(m.text !== undefined && { text: m.text }),
              ...(m.imageUrl !== undefined && { imageUrl: m.imageUrl }),
              ...(waMessageId !== null && { waMessageId }),
              isFromAi: true,
              sentAt,
            },
          });

          await this.inbound.publishOutbound({
            tenantId: event.tenantId,
            conversationId: event.conversationId,
            messageId: saved.id,
            waMessageId: waMessageId ?? undefined,
            type: m.type,
            text: m.text,
            imageUrl: m.imageUrl,
            sentAt: sentAt.toISOString(),
            isFromAi: true,
          });
        } catch (err) {
          this.logger.warn("Failed to persist outbound message:", err);
        }
      }
    }

    if (event.tenantId && event.conversationId && event.inactivityTimeoutMin) {
      const timeoutMin = event.inactivityTimeoutMin;
      if (timeoutMin > 0) {
        this.inactivityScheduler
          .schedule(
            {
              conversationId: event.conversationId,
              tenantId: event.tenantId,
              contactPhone: event.toPhone,
              waPhoneId: event.waPhoneId,
            },
            timeoutMin * 60_000,
          )
          .catch((err) => this.logger.error(`Failed to schedule inactivity timer: ${err?.message}`));
      }
    }
  }

  private resolveCrmPosition(aiStage: string): number | null {
    switch (aiStage) {
      case "greeting":
      case "discovery":
        return 1;
      case "catalog":
      case "negotiation":
        return 2;
      case "payment":
        return 3;
      default:
        return null;
    }
  }

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>("rabbitmq.url") as string;

    try {
      const connection = await amqplib.connect(url);
      const channel = await connection.createChannel();

      await channel.assertExchange("ai", "topic", { durable: true });
      const q = await channel.assertQueue("channel.outbound", { durable: true });
      await channel.bindQueue(q.queue, "ai", "ai.response");
      channel.prefetch(1);

      channel.consume(q.queue, async (msg) => {
        if (!msg) return;
        try {
          const event = JSON.parse(msg.content.toString()) as {
            tenantId?: string;
            conversationId?: string;
            waPhoneId: string;
            toPhone: string;
            inactivityTimeoutMin?: number;
            messages: Array<{ type: string; text?: string; imageUrl?: string }>;
            currentStage?: string;
            contactId?: string;
            triggerHandoff?: boolean;
            handoffReason?: string;
          };

          await this.handleOutboundMessage(event);

          if (event.triggerHandoff && event.tenantId && event.conversationId) {
            await this.prisma.conversation.updateMany({
              where: { id: event.conversationId, tenantId: event.tenantId },
              data: { status: "HUMAN_HANDOFF" },
            });
            await this.inbound.publishOutbound({
              tenantId: event.tenantId,
              conversationId: event.conversationId,
              type: "handoff",
              handoffReason: event.handoffReason ?? "Solicitado pelo agente IA",
              sentAt: new Date().toISOString(),
            });
            this.logger.log(`Conversation ${event.conversationId} → HUMAN_HANDOFF`);
          }

          if (event.tenantId && event.contactId && event.currentStage) {
            const targetPosition = this.resolveCrmPosition(event.currentStage);
            if (targetPosition !== null) {
              await this.inbound.publishCrmAdvance({
                tenantId: event.tenantId,
                contactId: event.contactId,
                targetPosition,
              }).catch((err) => this.logger.warn("crm.advance publish failed", err));
            }
          }

          channel.ack(msg);
        } catch (err) {
          this.logger.error("Outbound error:", err);
          channel.nack(msg, false, false);
        }
      });

      this.logger.log("✅ OutboundConsumer listening");
    } catch (err) {
      this.logger.warn("RabbitMQ not available, outbound consumer skipped:", err);
    }
  }
}
