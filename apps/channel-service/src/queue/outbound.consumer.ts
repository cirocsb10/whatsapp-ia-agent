import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqplib from "amqplib";
import { MessagingService } from "../messaging/messaging.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OutboundConsumer implements OnModuleInit {
  private readonly logger = new Logger(OutboundConsumer.name);

  constructor(
    private readonly config: ConfigService,
    private readonly messaging: MessagingService,
    private readonly prisma: PrismaService,
  ) {}

  async handleOutboundMessage(event: {
    tenantId?: string;
    conversationId?: string;
    waPhoneId: string;
    toPhone: string;
    messages: Array<{ type: string; text?: string; imageUrl?: string }>;
  }): Promise<void> {
    for (const m of event.messages) {
      await this.messaging.sendMessage(event.waPhoneId, event.toPhone, {
        type: m.type as "text" | "image" | "template",
        ...(m.text !== undefined && { text: m.text }),
        ...(m.imageUrl !== undefined && { imageUrl: m.imageUrl }),
      });

      if (event.tenantId && event.conversationId) {
        try {
          await this.prisma.message.create({
            data: {
              tenantId: event.tenantId,
              conversationId: event.conversationId,
              direction: "OUTBOUND",
              type: m.type.toUpperCase() as any,
              ...(m.text !== undefined && { text: m.text }),
              ...(m.imageUrl !== undefined && { imageUrl: m.imageUrl }),
              isFromAi: true,
              sentAt: new Date(),
            },
          });
        } catch (err) {
          this.logger.warn("Failed to persist outbound message:", err);
        }
      }

      await new Promise((r) => setTimeout(r, 400));
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
            messages: Array<{ type: string; text?: string; imageUrl?: string }>;
          };

          await this.handleOutboundMessage(event);
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
