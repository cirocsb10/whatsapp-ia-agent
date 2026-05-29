import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InboundProducer } from "../queue/inbound.producer";
import { SessionService } from "../session/session.service";
import { AudioService } from "../audio/audio.service";
import { PrismaService } from "../prisma/prisma.service";
import { MetaWebhookBody, MetaMessage } from "./dto/meta-webhook.dto";

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly inbound: InboundProducer,
    private readonly session: SessionService,
    private readonly audio: AudioService,
    private readonly prisma: PrismaService,
  ) {}

  async processWebhook(body: MetaWebhookBody): Promise<void> {
    for (const entry of body.entry) {
      for (const change of entry.changes) {
        if (change.field !== "messages") continue;
        const { value } = change;
        if (value.messages) {
          for (const msg of value.messages) {
            await this.processMessage(msg, value.metadata.phone_number_id);
          }
        }
      }
    }
  }

  private async processMessage(msg: MetaMessage, phoneNumberId: string): Promise<void> {
    if (await this.session.isDuplicate(msg.id)) {
      this.logger.warn(`Duplicate: ${msg.id}`);
      return;
    }

    const tenantId = await this.resolveTenantId(phoneNumberId);
    if (!tenantId) {
      this.logger.warn(`Rejecting webhook — no tenant for phone number ID: ${phoneNumberId}`);
      return;
    }

    // Opt-out check: if client sends opt-out keywords, skip
    const optOutKeywords = ["parar", "stop", "cancelar", "sair", "não quero"];
    if (msg.text?.body && optOutKeywords.some((k) => msg.text?.body.toLowerCase().includes(k))) {
      this.logger.log(`Opt-out detected from ${msg.from}`);
      // In production: update contact.isOptedOut = true via back-office API
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event: Record<string, any> = {
      tenantId,
      whatsappPhoneId: phoneNumberId,
      waMessageId: msg.id,
      from: msg.from,
      timestamp: parseInt(msg.timestamp, 10),
      type: msg.type,
    };

    if (msg.type === "text") {
      event["text"] = msg.text?.body;
    } else if (msg.type === "audio" && msg.audio?.id) {
      try {
        const { audioUrl, transcript } = await this.audio.downloadAndTranscribe(
          msg.audio.id,
          phoneNumberId,
        );
        event["audioId"] = msg.audio.id;
        event["audioUrl"] = audioUrl;
        event["audioTranscript"] = transcript;
      } catch (err) {
        this.logger.error(`Audio failed for ${msg.id}:`, err);
        event["audioId"] = msg.audio.id;
      }
    } else if (msg.type === "image") {
      event["imageId"] = msg.image?.id;
    } else if (msg.type === "document") {
      event["documentId"] = msg.document?.id;
      event["documentName"] = msg.document?.filename;
    }

    await this.inbound.publishInbound(event);
    this.logger.log(`Published: ${msg.type} from ${msg.from}`);
  }

  private async resolveTenantId(phoneNumberId: string): Promise<string | null> {
    const key = `tenant:phone:${phoneNumberId}`;

    // Try Redis cache first
    const cached = await this.session.get(key);
    if (cached) return cached;

    // Look up in database — NEVER fall back to a hardcoded value
    const tenant = await this.prisma.tenant.findFirst({
      where: { whatsappPhoneId: phoneNumberId },
      select: { id: true },
    });

    if (!tenant) {
      this.logger.warn(`No tenant found for phone number ID: ${phoneNumberId}`);
      return null; // Reject — do not route to wrong tenant
    }

    // Cache the authoritative mapping
    await this.session.set(key, tenant.id, 3600);
    return tenant.id;
  }

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = this.config.get<string>("meta.verifyToken");
    return mode === "subscribe" && token === verifyToken ? challenge : null;
  }
}
