import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import configuration from "./config/configuration";
import { HealthController } from "./health/health.controller";
import { WebhookController } from "./webhook/webhook.controller";
import { WebhookService } from "./webhook/webhook.service";
import { SessionService } from "./session/session.service";
import { AudioService } from "./audio/audio.service";
import { WhisperClient } from "./audio/whisper.client";
import { MetaApiClient } from "./messaging/meta-api.client";
import { MessagingService } from "./messaging/messaging.service";
import { InboundProducer } from "./queue/inbound.producer";
import { OutboundConsumer } from "./queue/outbound.consumer";
import { HmacGuard } from "./common/guards/hmac.guard";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
  ],
  controllers: [HealthController, WebhookController],
  providers: [
    WebhookService, SessionService, AudioService, WhisperClient,
    MetaApiClient, MessagingService, InboundProducer, OutboundConsumer, HmacGuard,
    ConfigService,
  ],
})
export class AppModule {}
