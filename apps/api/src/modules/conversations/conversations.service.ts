import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { EventsGateway } from "../../gateways/events.gateway";
import { CrmProgressionService } from "../crm/crm-progression.service";

const META_GRAPH_API = "https://graph.facebook.com/v21.0";

interface MessageRow {
  id: string;
  conversationId: string;
  waMessageId: string | null;
  direction: string;
  type: string;
  text: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  documentUrl: string | null;
  documentName: string | null;
  sentAt: Date;
  isFromAi: boolean;
  deliveredAt: Date | null;
  readAt: Date | null;
  failedAt: Date | null;
}

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: EventsGateway,
    private readonly crmProgression: CrmProgressionService,
  ) {}

  async findAll(tenantId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { tenantId },
      orderBy: [{ lastMessageAt: "desc" }, { startedAt: "desc" }],
      include: {
        contact: { select: { name: true, phone: true } },
        messages: {
          orderBy: { sentAt: "desc" },
          take: 1,
          select: { text: true, type: true, sentAt: true },
        },
      },
    });

    return conversations.map((conversation) => {
      const lastMessage = conversation.messages[0];
      return {
        id: conversation.id,
        contact: conversation.contact,
        status: conversation.status,
        lastMessage: lastMessage?.text ?? (lastMessage ? "[midia]" : undefined),
        lastMessageAt: lastMessage?.sentAt ?? conversation.lastMessageAt ?? conversation.startedAt,
        unreadCount: 0,
        isHandoff: conversation.status === "HUMAN_HANDOFF",
        isAssumed: !!conversation.assignedUserId,
      };
    });
  }

  private static readonly MESSAGE_SELECT = {
    id: true,
    conversationId: true,
    waMessageId: true,
    direction: true,
    type: true,
    text: true,
    imageUrl: true,
    audioUrl: true,
    documentUrl: true,
    documentName: true,
    sentAt: true,
    isFromAi: true,
    deliveredAt: true,
    readAt: true,
    failedAt: true,
  } as const;

  private mapMessage(m: MessageRow) {
    return {
      ...m,
      direction: m.direction.toLowerCase() as "inbound" | "outbound",
      type: m.type.toLowerCase(),
      imageUrl: m.imageUrl ?? undefined,
      audioUrl: m.audioUrl ?? undefined,
      documentUrl: m.documentUrl ?? undefined,
      documentName: m.documentName ?? undefined,
      deliveredAt: undefined,
      readAt: undefined,
      failedAt: undefined,
      messageStatus:
        m.direction === "OUTBOUND"
          ? m.failedAt
            ? "failed"
            : m.readAt
              ? "read"
              : m.deliveredAt
                ? "delivered"
                : "sent"
          : undefined,
    };
  }

  private async assertConversation(tenantId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { id: true },
    });
    if (!conversation) throw new NotFoundException("Conversation not found");
  }

  /**
   * Paginação por cursor (B2): retorna as `limit` mensagens mais recentes anteriores
   * ao cursor `before` (sentAt), em ordem ascendente para exibição. `nextCursor` é o
   * `sentAt` da mais antiga desta página (para buscar o lote anterior); `hasMore`
   * indica se há mensagens mais antigas. Empates exatos de `sentAt` são raros no
   * WhatsApp e ignorados por ora (refino futuro: tiebreaker por id).
   */
  async findMessagesPage(
    tenantId: string,
    conversationId: string,
    opts: { limit: number; before?: string },
  ) {
    await this.assertConversation(tenantId, conversationId);

    const limit = Math.min(Math.max(Math.trunc(opts.limit) || 30, 1), 100);
    const beforeDate = opts.before ? new Date(opts.before) : undefined;

    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        tenantId,
        ...(beforeDate ? { sentAt: { lt: beforeDate } } : {}),
      },
      orderBy: { sentAt: "desc" },
      take: limit + 1,
      select: ConversationsService.MESSAGE_SELECT,
    });

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const oldest = pageRows[pageRows.length - 1] as { sentAt: Date } | undefined;
    const nextCursor = hasMore && oldest ? oldest.sentAt.toISOString() : null;

    const messages = pageRows
      .slice()
      .reverse()
      .map((m) => this.mapMessage(m));

    return { messages, hasMore, nextCursor };
  }

  async assumeConversation(tenantId: string, conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { id: true, contactId: true },
    });
    if (!conversation) throw new NotFoundException("Conversation not found");

    await this.prisma.$transaction([
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          status: "HUMAN_HANDOFF",
          handoffAt: new Date(),
          handoffReason: "MANUAL",
          assignedUserId: userId,
        },
      }),
      this.prisma.handoffEvent.create({
        data: {
          tenantId,
          conversationId,
          reason: "MANUAL",
          triggeredBy: "AGENT",
          agentUserId: userId,
        },
      }),
    ]);

    await this.crmProgression.advanceToPosition(tenantId, conversation.contactId, 4);

    this.gateway.emitToTenant(tenantId, {
      type: "conversation_status_changed",
      payload: {
        conversationId,
        status: "HUMAN_HANDOFF",
        isHandoff: true,
        isAssumed: true,
      },
    });

    return { ok: true };
  }

  async releaseConversation(tenantId: string, conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { id: true },
    });
    if (!conversation) throw new NotFoundException("Conversation not found");

    await this.prisma.$transaction([
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { status: "ACTIVE", assignedUserId: null },
      }),
      this.prisma.handoffEvent.updateMany({
        where: { conversationId, resolvedAt: null },
        data: { resolvedAt: new Date() },
      }),
    ]);

    this.gateway.emitToTenant(tenantId, {
      type: "conversation_status_changed",
      payload: {
        conversationId,
        status: "ACTIVE",
        isHandoff: false,
        isAssumed: false,
      },
    });

    return { ok: true };
  }

  async sendOperatorMessage(
    tenantId: string,
    conversationId: string,
    userId: string,
    text: string,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: {
        contact: { select: { phone: true } },
        tenant: { select: { whatsappPhoneId: true, metaAccessToken: true } },
      },
    });

    if (!conversation) throw new NotFoundException("Conversation not found");
    if (conversation.status !== "HUMAN_HANDOFF") {
      throw new BadRequestException("Conversation is not in human handoff mode");
    }

    const whatsappPhoneId = conversation.tenant.whatsappPhoneId
      ?? process.env["META_TEST_PHONE_NUMBER_ID"]
      ?? null;
    const metaAccessToken = conversation.tenant.metaAccessToken
      ?? process.env["META_SYSTEM_USER_TOKEN"]
      ?? null;
    const toPhone = conversation.contact.phone;

    if (!whatsappPhoneId || !metaAccessToken) {
      throw new BadRequestException("WhatsApp credentials not configured for this tenant");
    }

    const message = await this.prisma.message.create({
      data: {
        tenantId,
        conversationId,
        direction: "OUTBOUND",
        type: "TEXT",
        text,
        isFromAi: false,
        sentAt: new Date(),
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    const metaRes = await fetch(`${META_GRAPH_API}/${whatsappPhoneId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${metaAccessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toPhone,
        type: "text",
        text: { body: text },
      }),
    });

    const metaJson = metaRes.ok ? (await metaRes.json() as any) : null;
    const waMessageId: string | null = metaJson?.messages?.[0]?.id ?? null;
    if (waMessageId) {
      await this.prisma.message.update({ where: { id: message.id }, data: { waMessageId } });
    }

    this.gateway.emitToTenant(tenantId, {
      type: "new_message",
      payload: {
        messageId: message.id,
        conversationId,
        direction: "outbound",
        type: "text",
        text,
        sentAt: message.sentAt.toISOString(),
        isFromAi: false,
        waMessageId: waMessageId ?? undefined,
        messageStatus: "sent",
      },
    });

    return { ok: true, messageId: message.id };
  }
}
