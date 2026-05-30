import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqplib from "amqplib";
import { MessagingService } from "../messaging/messaging.service";

@Injectable()
export class OutboundConsumer implements OnModuleInit {
  private readonly logger = new Logger(OutboundConsumer.name);

  constructor(
    private readonly config: ConfigService,
    private readonly messaging: MessagingService,
  ) {}

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
            waPhoneId: string;
            toPhone: string;
            messages: Array<{ type: string; text?: string; imageUrl?: string }>;
          };

          for (const m of event.messages) {
            await this.messaging.sendMessage(event.waPhoneId, event.toPhone, {
              type: m.type as "text" | "image" | "template",
              ...(m.text !== undefined && { text: m.text }),
              ...(m.imageUrl !== undefined && { imageUrl: m.imageUrl }),
            });
            await new Promise((r) => setTimeout(r, 400));
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
