import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { EventsGateway } from "../../gateways/events.gateway";
import { CrmProgressionService } from "../crm/crm-progression.service";
import type { UserRole } from "../../common/decorators/roles.decorator";

const META_GRAPH_API = "https://graph.facebook.com/v21.0";

export type ConversationActor = { id: string; role: UserRole };

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

type OutboundAttendingRow = {
  conversationId: string;
  isFromAi: boolean;
  sentByUserId: string | null;
  sentByUser: { id: string; name: string } | null;
};

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: EventsGateway,
    private readonly crmProgression: CrmProgressionService,
  ) {}

  private async channelScopeWhere(
    user: ConversationActor,
  ): Promise<Prisma.ConversationWhereInput> {
    if (user.role !== "AGENT") return {};
    const memberships = await this.prisma.whatsappChannelMember.findMany({
      where: { userId: user.id },
      select: { channelId: true },
    });
    return { channelId: { in: memberships.map((m) => m.channelId) } };
  }

  private deriveAttending(lastOutbound: OutboundAttendingRow | undefined): {
    attendingLabel: string | null;
    attendingUserId: string | null;
  } {
    if (!lastOutbound) {
      return { attendingLabel: null, attendingUserId: null };
    }
    if (lastOutbound.sentByUserId && lastOutbound.sentByUser) {
      return {
        attendingLabel: lastOutbound.sentByUser.name,
        attendingUserId: lastOutbound.sentByUserId,
      };
    }
    if (lastOutbound.isFromAi) {
      return { attendingLabel: "IA", attendingUserId: null };
    }
    return { attendingLabel: null, attendingUserId: null };
  }

  private async loadAttendingByConversation(
    conversationIds: string[],
  ): Promise<Map<string, OutboundAttendingRow>> {
    const map = new Map<string, OutboundAttendingRow>();
    if (conversationIds.length === 0) return map;

    const outbounds = await this.prisma.message.findMany({
      where: {
        conversationId: { in: conversationIds },
        direction: "OUTBOUND",
      },
      orderBy: { sentAt: "desc" },
      select: {
        conversationId: true,
        isFromAi: true,
        sentByUserId: true,
        sentByUser: { select: { id: true, name: true } },
      },
    });

    const stateByConversation = new Map<
      string,
      { human?: OutboundAttendingRow; hasAi: boolean }
    >();

    for (const row of outbounds) {
      const state = stateByConversation.get(row.conversationId) ?? { hasAi: false };

      if (
        !state.human &&
        !row.isFromAi &&
        row.sentByUserId &&
        row.sentByUser
      ) {
        state.human = row;
      }
      if (row.isFromAi) {
        state.hasAi = true;
      }
      stateByConversation.set(row.conversationId, state);
    }

    for (const [conversationId, state] of stateByConversation) {
      if (state.human) {
        map.set(conversationId, state.human);
      } else if (state.hasAi) {
        map.set(conversationId, {
          conversationId,
          isFromAi: true,
          sentByUserId: null,
          sentByUser: null,
        });
      }
    }

    return map;
  }

  async findAll(tenantId: string, user: ConversationActor) {
    const where: Prisma.ConversationWhereInput = {
      tenantId,
      ...(await this.channelScopeWhere(user)),
    };

    const conversations = await this.prisma.conversation.findMany({
      where,
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

    const attendingById = await this.loadAttendingByConversation(
      conversations.map((c) => c.id),
    );

    return conversations.map((conversation) => {
      const lastMessage = conversation.messages[0];
      const attending = this.deriveAttending(attendingById.get(conversation.id));
      return {
        id: conversation.id,
        contact: conversation.contact,
        status: conversation.status,
        lastMessage: lastMessage?.text ?? (lastMessage ? "[midia]" : undefined),
        lastMessageAt: lastMessage?.sentAt ?? conversation.lastMessageAt ?? conversation.startedAt,
        unreadCount: 0,
        isHandoff: conversation.status === "HUMAN_HANDOFF",
        isAssumed: !!conversation.assignedUserId,
        attendingLabel: attending.attendingLabel,
        attendingUserId: attending.attendingUserId,
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

  private async assertConversation(
    tenantId: string,
    conversationId: string,
    user: ConversationActor,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
        ...(await this.channelScopeWhere(user)),
      },
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
    user: ConversationActor,
  ) {
    await this.assertConversation(tenantId, conversationId, user);

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

  async assumeConversation(tenantId: string, conversationId: string, user: ConversationActor) {
    await this.assertConversation(tenantId, conversationId, user);

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
          assignedUserId: user.id,
        },
      }),
      this.prisma.handoffEvent.create({
        data: {
          tenantId,
          conversationId,
          reason: "MANUAL",
          triggeredBy: "AGENT",
          agentUserId: user.id,
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

  async releaseConversation(tenantId: string, conversationId: string, user: ConversationActor) {
    await this.assertConversation(tenantId, conversationId, user);

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
    user: ConversationActor,
    text: string,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
        ...(await this.channelScopeWhere(user)),
      },
      include: {
        contact: { select: { phone: true } },
        channel: { select: { whatsappPhoneId: true, metaAccessToken: true } },
        tenant: { select: { whatsappPhoneId: true, metaAccessToken: true } },
      },
    });

    if (!conversation) throw new NotFoundException("Conversation not found");
    if (conversation.status !== "HUMAN_HANDOFF") {
      throw new BadRequestException("Conversation is not in human handoff mode");
    }

    // Prefer the conversation's WhatsappChannel credentials; fall back to tenant scalars / env.
    const whatsappPhoneId = conversation.channel?.whatsappPhoneId
      ?? conversation.tenant.whatsappPhoneId
      ?? process.env["META_TEST_PHONE_NUMBER_ID"]
      ?? null;
    const metaAccessToken = conversation.channel?.metaAccessToken?.trim()
      || conversation.tenant.metaAccessToken
      || process.env["META_SYSTEM_USER_TOKEN"]
      || null;
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
        sentByUserId: user.id,
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
