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
  private readonly optOutKeywords = ["parar", "stop", "cancelar", "sair", "não quero"];

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

    const contact = await this.prisma.contact.upsert({
      where: { tenantId_phone: { tenantId, phone: msg.from } },
      update: { lastSeenAt: new Date() },
      create: { tenantId, phone: msg.from, firstSeenAt: new Date(), lastSeenAt: new Date() },
    });

    if (msg.text?.body && this.optOutKeywords.some((k) => msg.text?.body.toLowerCase().includes(k))) {
      this.logger.log(`Opt-out detected from ${msg.from}`);
      await this.prisma.contact.update({
        where: { tenantId_phone: { tenantId, phone: msg.from } },
        data: { isOptedOut: true, optOutAt: new Date() },
      });
      return;
    }

    let conversation = await this.prisma.conversation.findFirst({
      where: { contactId: contact.id, status: { in: ["ACTIVE", "HUMAN_HANDOFF"] } },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: { tenantId, contactId: contact.id, status: "ACTIVE", startedAt: new Date() },
      });
    }

    const msgType = msg.type.toUpperCase() as "TEXT" | "AUDIO" | "IMAGE" | "DOCUMENT";

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        tenantId,
        waMessageId: msg.id,
        direction: "INBOUND",
        type: msgType,
        text: msg.text?.body ?? null,
        sentAt: new Date(parseInt(msg.timestamp, 10) * 1000),
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    const event: Record<string, unknown> = {
      tenantId,
      whatsappPhoneId: phoneNumberId,
      waMessageId: msg.id,
      from: msg.from,
      timestamp: parseInt(msg.timestamp, 10),
      type: msg.type,
      conversationId: conversation.id,
      contactId: contact.id,
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
    this.logger.log(`Published: ${msg.type} from ${msg.from} (conv: ${conversation.id})`);
  }

  private async resolveTenantId(phoneNumberId: string): Promise<string | null> {
    const key = `tenant:phone:${phoneNumberId}`;
    const cached = await this.session.get(key);
    if (cached) return cached;

    const tenant = await this.prisma.tenant.findFirst({
      where: { whatsappPhoneId: phoneNumberId },
      select: { id: true },
    });

    if (!tenant) {
      this.logger.warn(`No tenant found for phone number ID: ${phoneNumberId}`);
      return null;
    }

    await this.session.set(key, tenant.id, 3600);
    return tenant.id;
  }

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = this.config.get<string>("meta.verifyToken");
    return mode === "subscribe" && token === verifyToken ? challenge : null;
  }
}
