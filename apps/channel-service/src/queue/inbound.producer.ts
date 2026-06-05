import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqplib from "amqplib";

const EXCHANGES = { MESSAGES: "messages", AI: "ai" } as const;
const ROUTING_KEYS = { MSG_INBOUND: "msg.inbound", MSG_STATUS: "msg.status", MSG_OUTBOUND: "msg.outbound" } as const;

@Injectable()
export class InboundProducer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InboundProducer.name);
  private connection!: amqplib.ChannelModel;
  private channel!: amqplib.Channel;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>("rabbitmq.url") as string;
    let retries = 5;
    while (retries > 0) {
      try {
        this.connection = await amqplib.connect(url);
        this.channel = await this.connection.createChannel();
        await this.channel.assertExchange(EXCHANGES.MESSAGES, "topic", { durable: true });
        await this.channel.assertExchange(EXCHANGES.AI, "topic", { durable: true });
        this.logger.log("✅ RabbitMQ producer connected");
        return;
      } catch {
        retries--;
        this.logger.warn(`RabbitMQ retry... (${retries} left)`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    throw new Error("Failed to connect to RabbitMQ");
  }

  async publishInbound(event: Record<string, unknown>): Promise<void> {
    const payload = Buffer.from(JSON.stringify(event));
    const published = this.channel.publish(EXCHANGES.MESSAGES, ROUTING_KEYS.MSG_INBOUND, payload, {
      persistent: true,
      contentType: "application/json",
      headers: { tenantId: event["tenantId"], messageType: event["type"] },
    });
    if (!published) {
      await new Promise<void>((resolve) => this.channel.once("drain", resolve));
    }
  }

  async publishStatusUpdate(event: Record<string, unknown>): Promise<void> {
    const payload = Buffer.from(JSON.stringify(event));
    this.channel.publish(EXCHANGES.MESSAGES, ROUTING_KEYS.MSG_STATUS, payload, {
      persistent: true,
      contentType: "application/json",
    });
  }

  async publishOutbound(event: Record<string, unknown>): Promise<void> {
    const payload = Buffer.from(JSON.stringify(event));
    this.channel.publish(EXCHANGES.MESSAGES, ROUTING_KEYS.MSG_OUTBOUND, payload, {
      persistent: true,
      contentType: "application/json",
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}
