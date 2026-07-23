import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InboundProducer } from "../queue/inbound.producer";
import { InactivitySchedulerService } from "../queue/inactivity-scheduler.service";
import { SessionService } from "../session/session.service";
import { AudioService } from "../audio/audio.service";
import { PrismaService } from "../prisma/prisma.service";
import { CrmAutoLeadService } from "../crm/crm-auto-lead.service";
import { MetaWebhookBody, MetaMessage } from "./dto/meta-webhook.dto";

export type ResolvedChannel = {
  tenantId: string;
  channelId: string | null;
  isAiEnabled: boolean;
  accessToken: string | null;
  whatsappPhoneId: string;
};

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
    private readonly crmAutoLead: CrmAutoLeadService,
    private readonly inactivityScheduler: InactivitySchedulerService,
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
        if (value.statuses) {
          for (const status of value.statuses) {
            await this.processStatus(status, value.metadata.phone_number_id);
          }
        }
      }
    }
  }

  private async processStatus(status: import("./dto/meta-webhook.dto").MetaStatus, phoneNumberId: string): Promise<void> {
    const resolved = await this.resolveChannel(phoneNumberId);
    if (!resolved) return;

    const { tenantId } = resolved;
    const ts = new Date(parseInt(status.timestamp, 10) * 1000);
    const data: Record<string, Date | string> = {};
    if (status.status === "delivered") data["deliveredAt"] = ts;
    else if (status.status === "read") data["readAt"] = ts;
    else if (status.status === "failed") data["failedAt"] = ts;

    const pricingCategory = status.pricing?.category?.trim();
    if (pricingCategory) data["pricingCategory"] = pricingCategory;

    // "sent" (and unknown) only persist when Meta also sent pricing metadata
    if (Object.keys(data).length === 0) return;

    const message = await this.prisma.message.findFirst({
      where: { waMessageId: status.id, tenantId },
      select: { id: true, conversationId: true },
    });
    if (!message) return;

    await this.prisma.message.update({ where: { id: message.id }, data });

    if (status.status === "delivered" || status.status === "read" || status.status === "failed") {
      await this.inbound.publishStatusUpdate({
        tenantId,
        conversationId: message.conversationId,
        waMessageId: status.id,
        status: status.status,
      });
    }
  }

  private async processMessage(msg: MetaMessage, phoneNumberId: string): Promise<void> {
    if (!msg.from || !msg.id) {
      this.logger.warn(`Skipping message without required fields (from: ${msg.from}, id: ${msg.id}, type: ${msg.type})`);
      return;
    }

    if (await this.session.isDuplicate(msg.id)) {
      this.logger.warn(`Duplicate: ${msg.id}`);
      return;
    }

    const resolved = await this.resolveChannel(phoneNumberId);
    if (!resolved) {
      this.logger.warn(`Rejecting webhook — no tenant/channel for phone number ID: ${phoneNumberId}`);
      return;
    }

    const { tenantId, channelId, isAiEnabled } = resolved;

    const { contact, conversation, isNewContact, justOptedOut } = await this.prisma.$transaction(async (tx) => {
      let isNewContact = false;
      let contact = await tx.contact.findUnique({
        where: { tenantId_phone: { tenantId, phone: msg.from } },
      });
      if (!contact) {
        isNewContact = true;
        contact = await tx.contact.create({
          data: { tenantId, phone: msg.from, firstSeenAt: new Date(), lastSeenAt: new Date() },
        });
      } else {
        await tx.contact.update({
          where: { id: contact.id },
          data: { lastSeenAt: new Date() },
        });
      }

      // Block opted-out contacts — do not process any further
      if (contact.isOptedOut) {
        this.logger.warn(`Blocked opted-out contact: ${msg.from}`);
        return { contact, conversation: null, isNewContact: false, justOptedOut: false };
      }

      // Opt-out keyword detection
      if (msg.text?.body && this.optOutKeywords.some((k) => msg.text?.body.toLowerCase().includes(k))) {
        this.logger.log(`Opt-out detected from ${msg.from}`);
        await tx.contact.update({
          where: { id: contact.id },
          data: { isOptedOut: true, optOutAt: new Date() },
        });
        return { contact, conversation: null, isNewContact, justOptedOut: true };
      }

      let conversation = await tx.conversation.findFirst({
        where: { contactId: contact.id, status: { in: ["ACTIVE", "HUMAN_HANDOFF"] } },
        orderBy: { startedAt: "desc" },
      });

      if (!conversation) {
        conversation = await tx.conversation.create({
          data: {
            tenantId,
            contactId: contact.id,
            status: "ACTIVE",
            startedAt: new Date(),
            ...(channelId ? { channelId } : {}),
          },
        });
      }

      const msgType = this.resolveMessageType(msg.type);

      try {
        await tx.message.create({
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
      } catch (e: unknown) {
        // P2002 = unique constraint — waMessageId already processed (Redis TTL expired but DB has it)
        if ((e as { code?: string })?.code === "P2002") {
          this.logger.warn(`Already processed waMessageId: ${msg.id}`);
          return { contact, conversation: null, isNewContact: false, justOptedOut: false };
        }
        throw e;
      }

      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          ...(channelId ? { channelId } : {}),
        },
      });

      return { contact, conversation, isNewContact, justOptedOut: false };
    });

    if (isNewContact) {
      await this.crmAutoLead.maybeCreateLead(tenantId, contact.id, contact.phone, contact.name ?? undefined);
    }

    if (justOptedOut) {
      await this.crmAutoLead.advanceToLost(tenantId, contact.id);
      return;
    }

    if (!conversation) return;

    // Gate: só rotear para IA se o agente estiver publicado E o canal tiver IA habilitada
    const published = await this.isAgentPublished(tenantId);
    if (!published || !isAiEnabled) {
      this.logger.log(
        `AI gate closed for tenant ${tenantId} (published=${published}, isAiEnabled=${isAiEnabled}) — message saved but not routed`,
      );
      return;
    }

    const event: Record<string, unknown> = {
      tenantId,
      whatsappPhoneId: phoneNumberId,
      waMessageId: msg.id,
      from: msg.from,
      timestamp: parseInt(msg.timestamp, 10),
      type: msg.type,
      conversationId: conversation.id,
      contactId: contact.id,
      conversationStatus: conversation.status,
      ...(channelId ? { channelId } : {}),
    };

    if (msg.type === "text") {
      event["text"] = msg.text?.body;
    } else if (msg.type === "audio" && msg.audio?.id) {
      event["audioId"] = msg.audio.id;
      try {
        const { audioUrl, transcript } = await this.audio.downloadAndTranscribe(
          msg.audio.id,
          phoneNumberId,
        );
        event["audioUrl"] = audioUrl;
        event["audioTranscript"] = transcript;
        await this.prisma.message.updateMany({
          where: { waMessageId: msg.id },
          data: { audioUrl, audioTranscript: transcript },
        });
      } catch (err) {
        this.logger.error(`Audio failed for ${msg.id}:`, err);
      }
    } else if (msg.type === "image" && msg.image?.id) {
      event["imageId"] = msg.image.id;
      try {
        const imageUrl = await this.audio.downloadImageAndStore(msg.image.id);
        event["imageUrl"] = imageUrl;
        await this.prisma.message.updateMany({
          where: { waMessageId: msg.id },
          data: { imageUrl },
        });
      } catch (err) {
        this.logger.error(`Image failed for ${msg.id}:`, err);
      }
    } else if (msg.type === "document" && msg.document?.id) {
      const docName = msg.document.filename ?? "documento";
      event["documentId"] = msg.document.id;
      try {
        const docUrl = await this.audio.downloadDocumentAndStore(msg.document.id, docName);
        event["documentUrl"] = docUrl;
        event["documentName"] = docName;
        await this.prisma.message.updateMany({
          where: { waMessageId: msg.id },
          data: { documentUrl: docUrl, documentName: docName },
        });
      } catch (err) {
        this.logger.error(`Document failed for ${msg.id}:`, err);
        event["documentName"] = docName;
      }
    }

    await this.inbound.publishInbound(event);
    this.logger.log(`Published: ${msg.type} from ${msg.from} (conv: ${conversation.id})`);

    if (conversation.status === "ACTIVE") {
      this.scheduleInactivityTimer(tenantId, conversation.id, msg.from, phoneNumberId).catch(
        (err) => this.logger.error(`Failed to schedule inactivity timer: ${err?.message}`),
      );
    }
  }

  private async scheduleInactivityTimer(
    tenantId: string,
    conversationId: string,
    contactPhone: string,
    waPhoneId: string,
  ): Promise<void> {
    const config = await this.prisma.agentConfig.findUnique({
      where: { tenantId },
      select: { inactivityTimeoutMin: true },
    });
    const timeoutMin = config?.inactivityTimeoutMin ?? 30;
    if (timeoutMin <= 0) return;

    await this.inactivityScheduler.schedule(
      { conversationId, tenantId, contactPhone, waPhoneId },
      timeoutMin * 60_000,
    );
  }

  private resolveMessageType(type: string): "TEXT" | "AUDIO" | "IMAGE" | "DOCUMENT" | "STICKER" | "LOCATION" | "INTERACTIVE" {
    const known = ["TEXT", "AUDIO", "IMAGE", "DOCUMENT", "STICKER", "LOCATION", "INTERACTIVE"];
    const upper = type.toUpperCase();
    return (known.includes(upper) ? upper : "TEXT") as ReturnType<typeof this.resolveMessageType>;
  }

  private async isAgentPublished(tenantId: string): Promise<boolean> {
    const key = `agent:published:${tenantId}`;
    const cached = await this.session.get(key);
    if (cached !== null) return cached === "true";

    const config = await this.prisma.agentConfig.findFirst({
      where: { tenantId },
      select: { isPublished: true },
    });

    const published = config?.isPublished ?? false;
    await this.session.set(key, String(published), 60);
    return published;
  }

  /** Resolve WhatsappChannel by phone_number_id; falls back to Tenant scalars for one release. */
  async resolveChannel(phoneNumberId: string): Promise<ResolvedChannel | null> {
    const key = `channel:phone:${phoneNumberId}`;
    const cached = await this.session.get(key);
    if (cached) {
      try {
        return JSON.parse(cached) as ResolvedChannel;
      } catch {
        this.logger.warn(`Invalid channel cache for ${phoneNumberId}; re-resolving`);
      }
    }

    const channel = await this.prisma.whatsappChannel.findUnique({
      where: { whatsappPhoneId: phoneNumberId },
      select: {
        id: true,
        tenantId: true,
        isAiEnabled: true,
        metaAccessToken: true,
        whatsappPhoneId: true,
      },
    });
    if (channel) {
      const resolved: ResolvedChannel = {
        tenantId: channel.tenantId,
        channelId: channel.id,
        isAiEnabled: channel.isAiEnabled,
        accessToken: channel.metaAccessToken,
        whatsappPhoneId: channel.whatsappPhoneId,
      };
      await this.session.set(key, JSON.stringify(resolved), 3600);
      return resolved;
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: { whatsappPhoneId: phoneNumberId },
      select: { id: true, metaAccessToken: true, whatsappPhoneId: true },
    });
    if (!tenant) {
      this.logger.warn(`No channel/tenant found for phone number ID: ${phoneNumberId}`);
      return null;
    }

    const resolved: ResolvedChannel = {
      tenantId: tenant.id,
      channelId: null,
      isAiEnabled: true,
      accessToken: tenant.metaAccessToken,
      whatsappPhoneId: tenant.whatsappPhoneId!,
    };
    await this.session.set(key, JSON.stringify(resolved), 3600);
    return resolved;
  }

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = this.config.get<string>("meta.verifyToken");
    return mode === "subscribe" && token === verifyToken ? challenge : null;
  }
}
