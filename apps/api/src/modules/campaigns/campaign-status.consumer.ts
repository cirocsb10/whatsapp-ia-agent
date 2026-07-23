import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqplib from "amqplib";
import { CampaignStatusService, type CampaignDeliveryStatus } from "./campaign-status.service";

const EXCHANGE = "messages";
const ROUTING_KEY = "campaign.status";
const QUEUE = "api.campaign.status";

/** Build applyStatusUpdate input without passing `failureReason: undefined` (exactOptionalPropertyTypes). */
export function toCampaignStatusUpdateInput(event: {
  tenantId: string;
  waMessageId: string;
  status: CampaignDeliveryStatus;
  timestamp: number;
  failureReason?: string;
}): {
  tenantId: string;
  waMessageId: string;
  status: CampaignDeliveryStatus;
  timestamp: number;
  failureReason?: string;
} {
  return {
    tenantId: event.tenantId,
    waMessageId: event.waMessageId,
    status: event.status,
    timestamp: event.timestamp,
    ...(event.failureReason !== undefined ? { failureReason: event.failureReason } : {}),
  };
}

@Injectable()
export class CampaignStatusConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CampaignStatusConsumer.name);
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly statusService: CampaignStatusService,
  ) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>("RABBITMQ_URL") ?? "amqp://localhost:5672";
    let retries = 5;

    while (retries > 0) {
      try {
        this.connection = await amqplib.connect(url);
        this.channel = await this.connection.createChannel();
        this.channel.prefetch(20);

        await this.channel.assertExchange(EXCHANGE, "topic", { durable: true });
        const q = await this.channel.assertQueue(QUEUE, { durable: true });
        await this.channel.bindQueue(q.queue, EXCHANGE, ROUTING_KEY);

        this.channel.consume(q.queue, (msg) => void this.handle(msg));
        this.logger.log("✅ CampaignStatusConsumer listening");
        return;
      } catch {
        retries -= 1;
        this.logger.warn(`RabbitMQ retry... (${retries} left)`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    this.logger.warn("RabbitMQ unavailable — campaign status consumer disabled");
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  private async handle(msg: amqplib.Message | null): Promise<void> {
    if (!msg || !this.channel) return;
    try {
      const event = JSON.parse(msg.content.toString()) as {
        tenantId?: string;
        waMessageId?: string;
        status?: CampaignDeliveryStatus;
        timestamp?: number;
        failureReason?: string;
      };

      if (event.tenantId && event.waMessageId && event.status && event.timestamp) {
        await this.statusService.applyStatusUpdate(
          toCampaignStatusUpdateInput({
            tenantId: event.tenantId,
            waMessageId: event.waMessageId,
            status: event.status,
            timestamp: event.timestamp,
            ...(event.failureReason !== undefined
              ? { failureReason: event.failureReason }
              : {}),
          }),
        );
      }

      this.channel.ack(msg);
    } catch (err) {
      this.logger.error("campaign.status handle error:", err);
      this.channel.nack(msg, false, false);
    }
  }
}
