import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqplib from "amqplib";
import { EventsGateway } from "../gateways/events.gateway";

@Injectable()
export class InboxEventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InboxEventsConsumer.name);
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly gateway: EventsGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>("RABBITMQ_URL") ?? "amqp://localhost:5672";
    let retries = 5;

    while (retries > 0) {
      try {
        this.connection = await amqplib.connect(url);
        this.channel = await this.connection.createChannel();
        this.channel.prefetch(10);

        await this.channel.assertExchange("messages", "topic", { durable: true });
        await this.channel.assertExchange("ai", "topic", { durable: true });

        // Queue for inbound messages → emit to frontend
        const inboundQ = await this.channel.assertQueue("api.inbox.inbound", { durable: true });
        await this.channel.bindQueue(inboundQ.queue, "messages", "msg.inbound");

        // Queue for AI responses → emit to frontend
        const outboundQ = await this.channel.assertQueue("api.inbox.outbound", { durable: true });
        await this.channel.bindQueue(outboundQ.queue, "ai", "ai.response");

        this.channel.consume(inboundQ.queue, (msg: amqplib.Message | null) => this.handleInbound(msg));
        this.channel.consume(outboundQ.queue, (msg: amqplib.Message | null) => this.handleOutbound(msg));

        this.logger.log("✅ InboxEventsConsumer listening (inbound + outbound)");
        return;
      } catch {
        retries--;
        this.logger.warn(`RabbitMQ retry... (${retries} left)`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    this.logger.warn("RabbitMQ unavailable — real-time inbox events disabled");
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  private handleInbound(msg: amqplib.Message | null): void {
    if (!msg || !this.channel) return;
    try {
      const event = JSON.parse(msg.content.toString()) as Record<string, unknown>;
      const tenantId = event["tenantId"] as string;
      const conversationId = event["conversationId"] as string;

      if (!tenantId || !conversationId) {
        this.channel.ack(msg);
        return;
      }

      const text = (event["text"] as string | undefined)
        ?? (event["audioTranscript"] as string | undefined);

      this.gateway.emitToTenant(tenantId, {
        type: "new_message",
        payload: {
          messageId: event["waMessageId"] ?? String(Date.now()),
          conversationId,
          direction: "inbound",
          type: (event["type"] as string ?? "text").toLowerCase(),
          text: text ?? null,
          imageUrl: event["imageUrl"] ?? null,
          audioUrl: event["audioUrl"] ?? null,
          documentUrl: event["documentUrl"] ?? null,
          documentName: event["documentName"] ?? null,
          sentAt: event["timestamp"]
            ? new Date((event["timestamp"] as number) * 1000).toISOString()
            : new Date().toISOString(),
          isFromAi: false,
        },
      });

      this.channel.ack(msg);
    } catch (err) {
      this.logger.error("handleInbound error:", err);
      this.channel.nack(msg, false, false);
    }
  }

  private handleOutbound(msg: amqplib.Message | null): void {
    if (!msg || !this.channel) return;
    try {
      const event = JSON.parse(msg.content.toString()) as Record<string, unknown>;
      const tenantId = event["tenantId"] as string;
      const conversationId = event["conversationId"] as string;
      const messages = (event["messages"] as Array<Record<string, unknown>>) ?? [];

      if (!tenantId || !conversationId) {
        this.channel.ack(msg);
        return;
      }

      const now = new Date().toISOString();
      for (const m of messages) {
        this.gateway.emitToTenant(tenantId, {
          type: "new_message",
          payload: {
            messageId: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            conversationId,
            direction: "outbound",
            type: (m["type"] as string ?? "text").toLowerCase(),
            text: m["text"] ?? null,
            imageUrl: m["imageUrl"] ?? null,
            sentAt: now,
            isFromAi: true,
          },
        });
      }

      this.channel.ack(msg);
    } catch (err) {
      this.logger.error("handleOutbound error:", err);
      this.channel.nack(msg, false, false);
    }
  }
}
