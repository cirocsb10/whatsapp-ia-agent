import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, RedisClientType } from "redis";

@Injectable()
export class SessionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionService.name);
  private client!: RedisClientType;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.config.get<string>("redis.url") ?? "redis://localhost:6379";
    this.client = createClient({ url: redisUrl }) as RedisClientType;
    this.client.on("error", (err) => this.logger.error("Redis error:", err));
    await this.client.connect();
    this.logger.log("✅ Redis connected");
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit();
  }

  async isDuplicate(messageId: string): Promise<boolean> {
    const key = `dedup:${messageId}`;
    const ttl = this.config.get<number>("redis.deduplicationTtlSeconds") ?? 60;
    const result = await this.client.set(key, "1", { NX: true, EX: ttl });
    return result === null;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, { EX: ttlSeconds });
  }

  async deleteSession(tenantId: string, contactPhone: string): Promise<void> {
    const key = `session:${tenantId}:${contactPhone}`;
    await this.client.del(key);
  }
}
