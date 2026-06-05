import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
