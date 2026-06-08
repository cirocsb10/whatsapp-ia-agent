import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import configuration from "./config/configuration";
import { HealthController } from "./health/health.controller";
import { WebhookController } from "./webhook/webhook.controller";
import { WebhookService } from "./webhook/webhook.service";
import { AudioService } from "./audio/audio.service";
import { WhisperClient } from "./audio/whisper.client";
import { InboundProducer } from "./queue/inbound.producer";
import { OutboundConsumer } from "./queue/outbound.consumer";
import { QueueModule } from "./queue/queue.module";
import { HmacGuard } from "./common/guards/hmac.guard";
import { PrismaModule } from "./prisma/prisma.module";
import { CrmAutoLeadService } from "./crm/crm-auto-lead.service";
import { SessionModule } from "./session/session.module";
import { MessagingModule } from "./messaging/messaging.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>("redis.url") ?? "redis://localhost:6379" },
      }),
    }),
    PrismaModule,
    SessionModule,
    MessagingModule,
    QueueModule,
  ],
  controllers: [HealthController, WebhookController],
  providers: [
    WebhookService,
    AudioService,
    WhisperClient,
    InboundProducer,
    OutboundConsumer,
    HmacGuard,
    ConfigService,
    CrmAutoLeadService,
  ],
})
export class AppModule {}
