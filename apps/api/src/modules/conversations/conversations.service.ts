import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { EventsGateway } from "../../gateways/events.gateway";

const META_GRAPH_API = "https://graph.facebook.com/v21.0";

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: EventsGateway,
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

  async findMessages(tenantId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { id: true },
    });
    if (!conversation) throw new NotFoundException("Conversation not found");

    const messages = await this.prisma.message.findMany({
      where: { conversationId, tenantId },
      orderBy: { sentAt: "asc" },
      select: {
        id: true,
        conversationId: true,
        direction: true,
        type: true,
        text: true,
        imageUrl: true,
        audioUrl: true,
        documentUrl: true,
        documentName: true,
        sentAt: true,
        isFromAi: true,
      },
    });

    return messages.map((m) => ({
      ...m,
      direction: m.direction.toLowerCase() as "inbound" | "outbound",
      type: m.type.toLowerCase(),
      imageUrl: m.imageUrl ?? undefined,
      audioUrl: m.audioUrl ?? undefined,
      documentUrl: m.documentUrl ?? undefined,
      documentName: m.documentName ?? undefined,
    }));
  }

  async assumeConversation(tenantId: string, conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { id: true },
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

    const { whatsappPhoneId, metaAccessToken } = conversation.tenant;
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

    await fetch(`${META_GRAPH_API}/${whatsappPhoneId}/messages`, {
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
      },
    });

    return { ok: true, messageId: message.id };
  }
}
