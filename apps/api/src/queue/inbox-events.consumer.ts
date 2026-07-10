import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqplib from "amqplib";
import { EventsGateway } from "../gateways/events.gateway";
import { CrmProgressionService } from "../modules/crm/crm-progression.service";

@Injectable()
export class InboxEventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InboxEventsConsumer.name);
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly gateway: EventsGateway,
    private readonly crmProgression: CrmProgressionService,
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
        await this.channel.assertExchange("crm", "topic", { durable: true });

        // Queue for inbound messages → emit to frontend
        const inboundQ = await this.channel.assertQueue("api.inbox.inbound", { durable: true });
        await this.channel.bindQueue(inboundQ.queue, "messages", "msg.inbound");

        // Queue for outbound messages saved by channel-service (includes waMessageId)
        const outboundQ = await this.channel.assertQueue("api.inbox.outbound.saved", { durable: true });
        await this.channel.bindQueue(outboundQ.queue, "messages", "msg.outbound");

        // Queue for message status updates (sent/delivered/read/failed)
        const statusQ = await this.channel.assertQueue("api.inbox.status", { durable: true });
        await this.channel.bindQueue(statusQ.queue, "messages", "msg.status");

        const crmQ = await this.channel.assertQueue("api.crm.advance", { durable: true });
        await this.channel.bindQueue(crmQ.queue, "crm", "crm.advance");

        this.channel.consume(inboundQ.queue, (msg: amqplib.Message | null) => this.handleInbound(msg));
        this.channel.consume(outboundQ.queue, (msg: amqplib.Message | null) => this.handleOutbound(msg));
        this.channel.consume(statusQ.queue, (msg: amqplib.Message | null) => this.handleStatus(msg));
        this.channel.consume(crmQ.queue, (msg: amqplib.Message | null) => void this.handleCrmAdvance(msg));

        // Tokens parciais da IA (só inbox — WhatsApp continua com ai.response completo)
        const streamQ = await this.channel.assertQueue("api.inbox.stream", {
          durable: false,
          exclusive: false,
          autoDelete: false,
          arguments: { "x-message-ttl": 60_000 },
        });
        await this.channel.bindQueue(streamQ.queue, "ai", "ai.stream");
        this.channel.consume(streamQ.queue, (msg: amqplib.Message | null) => this.handleStream(msg));

        this.logger.log("✅ InboxEventsConsumer listening (inbound + outbound + stream + crm)");
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

  private handleStream(msg: amqplib.Message | null): void {
    if (!msg || !this.channel) return;
    try {
      const envelope = JSON.parse(msg.content.toString()) as {
        event?: string;
        payload?: Record<string, unknown>;
      };
      const eventType = envelope.event;
      const payload = envelope.payload ?? {};
      const tenantId = payload["tenantId"] as string | undefined;
      const conversationId = payload["conversationId"] as string | undefined;

      if (
        tenantId &&
        conversationId &&
        (eventType === "ai_stream_started" ||
          eventType === "ai_stream_token" ||
          eventType === "ai_stream_ended")
      ) {
        this.gateway.emitToTenant(tenantId, {
          type: eventType,
          payload,
        });

        // Ao começar o stream, o "digitando" vira balão — encerra o typing indicator.
        if (eventType === "ai_stream_started") {
          this.gateway.emitToTenant(tenantId, {
            type: "ai_typing_stopped",
            payload: { conversationId },
          });
        }
      }

      this.channel.ack(msg);
    } catch (err) {
      this.logger.error("handleStream error:", err);
      this.channel.nack(msg, false, false);
    }
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

      // A IA vai responder assim que a mensagem do cliente chega, exceto quando a
      // conversa está com humano ou pausada. Emitimos o indicador "IA digitando"
      // para dar feedback imediato no inbox enquanto o orchestrator processa.
      const status = event["conversationStatus"] as string | undefined;
      if (status !== "HUMAN_HANDOFF" && status !== "PAUSED") {
        this.gateway.emitToTenant(tenantId, {
          type: "ai_typing_started",
          payload: { conversationId },
        });
      }

      this.channel.ack(msg);
    } catch (err) {
      this.logger.error("handleInbound error:", err);
      this.channel.nack(msg, false, false);
    }
  }

  private handleStatus(msg: amqplib.Message | null): void {
    if (!msg || !this.channel) return;
    try {
      const event = JSON.parse(msg.content.toString()) as Record<string, unknown>;
      const tenantId = event["tenantId"] as string;
      const conversationId = event["conversationId"] as string;
      const waMessageId = event["waMessageId"] as string;
      const status = event["status"] as string;

      if (tenantId && conversationId && waMessageId && status) {
        this.gateway.emitToTenant(tenantId, {
          type: "message_status_changed",
          payload: { conversationId, waMessageId, status },
        });
      }

      this.channel.ack(msg);
    } catch (err) {
      this.logger.error("handleStatus error:", err);
      this.channel?.nack(msg, false, false);
    }
  }

  private async handleCrmAdvance(msg: amqplib.Message | null): Promise<void> {
    if (!msg || !this.channel) return;
    try {
      const { tenantId, contactId, targetPosition } = JSON.parse(msg.content.toString()) as {
        tenantId: string;
        contactId: string;
        targetPosition: number;
      };
      await this.crmProgression.advanceToPosition(tenantId, contactId, targetPosition);
      this.channel.ack(msg);
    } catch (err) {
      this.logger.error("handleCrmAdvance error:", err);
      this.channel.nack(msg, false, false);
    }
  }

  private handleOutbound(msg: amqplib.Message | null): void {
    if (!msg || !this.channel) return;
    try {
      const event = JSON.parse(msg.content.toString()) as Record<string, unknown>;
      const tenantId = event["tenantId"] as string;
      const conversationId = event["conversationId"] as string;

      if (!tenantId || !conversationId) {
        this.channel.ack(msg);
        return;
      }

      if ((event["type"] as string) === "handoff") {
        this.gateway.emitToTenant(tenantId, {
          type: "ai_typing_stopped",
          payload: { conversationId },
        });
        this.gateway.emitToTenant(tenantId, {
          type: "handoff_created",
          payload: { conversationId, handoffReason: event["handoffReason"] ?? null },
        });
        this.gateway.emitToTenant(tenantId, {
          type: "conversation_status_changed",
          payload: { conversationId, status: "HUMAN_HANDOFF" },
        });
        this.channel.ack(msg);
        return;
      }

      // Resposta da IA chegou (ou mensagem do operador): encerra o "IA digitando".
      // Emitir em toda mensagem outbound é idempotente no frontend.
      if (event["isFromAi"] !== false) {
        this.gateway.emitToTenant(tenantId, {
          type: "ai_typing_stopped",
          payload: { conversationId },
        });
      }

      this.gateway.emitToTenant(tenantId, {
        type: "new_message",
        payload: {
          messageId: event["messageId"],
          conversationId,
          direction: "outbound",
          type: ((event["type"] as string) ?? "text").toLowerCase(),
          text: event["text"] ?? null,
          imageUrl: event["imageUrl"] ?? null,
          sentAt: event["sentAt"] ?? new Date().toISOString(),
          isFromAi: event["isFromAi"] ?? true,
          waMessageId: event["waMessageId"] ?? undefined,
          messageStatus: "sent",
        },
      });

      this.channel.ack(msg);
    } catch (err) {
      this.logger.error("handleOutbound error:", err);
      this.channel.nack(msg, false, false);
    }
  }
}
