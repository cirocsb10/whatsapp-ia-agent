import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaService } from "../../common/prisma/prisma.service";
import { EventsGateway } from "../../gateways/events.gateway";
import { ConversationsService } from "./conversations.service";
import { CrmProgressionService } from "../crm/crm-progression.service";

const mockCrmProgression = { advanceToPosition: jest.fn().mockResolvedValue(undefined), advanceToWon: jest.fn() };

const mockPrisma = {
  conversation: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  message: { findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  whatsappChannelMember: { findMany: jest.fn() },
  handoffEvent: { create: jest.fn(), updateMany: jest.fn() },
  $transaction: jest.fn(),
};

const ownerUser = { id: "u-owner", role: "OWNER" as const };
const agentUser = { id: "u-agent", role: "AGENT" as const };

const mockGateway = { emitToTenant: jest.fn() };

describe("ConversationsService", () => {
  let service: ConversationsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventsGateway, useValue: mockGateway },
        { provide: CrmProgressionService, useValue: mockCrmProgression },
      ],
    }).compile();
    service = module.get(ConversationsService);
    jest.clearAllMocks();
  });

  it("maps conversations for inbox", async () => {
    const now = new Date();
    mockPrisma.conversation.findMany.mockResolvedValue([
      {
        id: "c-1",
        contact: { name: "Ana", phone: "5511" },
        status: "ACTIVE",
        startedAt: now,
        lastMessageAt: now,
        assignedUserId: null,
        messages: [{ text: "Oi", sentAt: now, type: "TEXT" }],
      },
    ]);
    mockPrisma.message.findMany.mockResolvedValue([]);

    await expect(service.findAll("t-1", ownerUser)).resolves.toEqual([
      expect.objectContaining({ id: "c-1", lastMessage: "Oi", unreadCount: 0 }),
    ]);
  });

  it("maps media-only message as [midia]", async () => {
    const now = new Date();
    mockPrisma.conversation.findMany.mockResolvedValue([
      {
        id: "c-2",
        contact: { name: "Bob", phone: "5522" },
        status: "ACTIVE",
        startedAt: now,
        lastMessageAt: now,
        assignedUserId: null,
        messages: [{ text: null, sentAt: now, type: "IMAGE" }],
      },
    ]);
    mockPrisma.message.findMany.mockResolvedValue([]);

    const result = await service.findAll("t-1", ownerUser);
    expect(result[0]!.lastMessage).toBe("[midia]");
  });

  describe("membership visibility", () => {
    it("OWNER sees all tenant conversations (no channel filter)", async () => {
      mockPrisma.conversation.findMany.mockResolvedValue([]);
      mockPrisma.message.findMany.mockResolvedValue([]);

      await service.findAll("t-1", ownerUser);

      expect(mockPrisma.whatsappChannelMember.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: "t-1" } }),
      );
    });

    it("ADMIN sees all tenant conversations (no channel filter)", async () => {
      mockPrisma.conversation.findMany.mockResolvedValue([]);
      mockPrisma.message.findMany.mockResolvedValue([]);

      await service.findAll("t-1", { id: "u-admin", role: "ADMIN" });

      expect(mockPrisma.whatsappChannelMember.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: "t-1" } }),
      );
    });

    it("AGENT only sees conversations in member channels", async () => {
      mockPrisma.whatsappChannelMember.findMany.mockResolvedValue([
        { channelId: "ch-1" },
        { channelId: "ch-2" },
      ]);
      mockPrisma.conversation.findMany.mockResolvedValue([]);
      mockPrisma.message.findMany.mockResolvedValue([]);

      await service.findAll("t-1", agentUser);

      expect(mockPrisma.whatsappChannelMember.findMany).toHaveBeenCalledWith({
        where: { userId: "u-agent" },
        select: { channelId: true },
      });
      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: "t-1", channelId: { in: ["ch-1", "ch-2"] } },
        }),
      );
    });
  });

  describe("attending indicator", () => {
    it("derives attending from last human outbound with sentByUserId", async () => {
      const now = new Date();
      mockPrisma.conversation.findMany.mockResolvedValue([
        {
          id: "c-1",
          contact: { name: "Ana", phone: "5511" },
          status: "HUMAN_HANDOFF",
          startedAt: now,
          lastMessageAt: now,
          assignedUserId: "u-agent",
          messages: [{ text: "Oi", sentAt: now, type: "TEXT" }],
        },
      ]);
      mockPrisma.message.findMany.mockResolvedValue([
        {
          conversationId: "c-1",
          isFromAi: false,
          sentByUserId: "u-agent",
          sentByUser: { id: "u-agent", name: "Carlos" },
        },
      ]);

      const result = await service.findAll("t-1", ownerUser);

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            conversationId: { in: ["c-1"] },
            direction: "OUTBOUND",
          },
          orderBy: { sentAt: "desc" },
        }),
      );
      expect(result[0]).toEqual(
        expect.objectContaining({
          attendingLabel: "Carlos",
          attendingUserId: "u-agent",
        }),
      );
    });

    it("keeps human attending when AI replies after human outbound", async () => {
      const now = new Date();
      mockPrisma.conversation.findMany.mockResolvedValue([
        {
          id: "c-1",
          contact: { name: "Ana", phone: "5511" },
          status: "HUMAN_HANDOFF",
          startedAt: now,
          lastMessageAt: now,
          assignedUserId: "u-agent",
          messages: [{ text: "Resposta IA", sentAt: now, type: "TEXT" }],
        },
      ]);
      mockPrisma.message.findMany.mockResolvedValue([
        {
          conversationId: "c-1",
          isFromAi: true,
          sentByUserId: null,
          sentByUser: null,
        },
        {
          conversationId: "c-1",
          isFromAi: false,
          sentByUserId: "u-agent",
          sentByUser: { id: "u-agent", name: "Carlos" },
        },
      ]);

      const result = await service.findAll("t-1", ownerUser);

      expect(result[0]).toEqual(
        expect.objectContaining({
          attendingLabel: "Carlos",
          attendingUserId: "u-agent",
        }),
      );
    });

    it('AI-only outbound → attendingLabel "IA"', async () => {
      const now = new Date();
      mockPrisma.conversation.findMany.mockResolvedValue([
        {
          id: "c-1",
          contact: { name: "Ana", phone: "5511" },
          status: "ACTIVE",
          startedAt: now,
          lastMessageAt: now,
          assignedUserId: null,
          messages: [{ text: "Oi", sentAt: now, type: "TEXT" }],
        },
      ]);
      mockPrisma.message.findMany.mockResolvedValue([
        {
          conversationId: "c-1",
          isFromAi: true,
          sentByUserId: null,
          sentByUser: null,
        },
      ]);

      const result = await service.findAll("t-1", ownerUser);

      expect(result[0]).toEqual(
        expect.objectContaining({
          attendingLabel: "IA",
          attendingUserId: null,
        }),
      );
    });
  });

  describe("assertConversation access", () => {
    it("AGENT cannot access conversation outside memberships", async () => {
      mockPrisma.whatsappChannelMember.findMany.mockResolvedValue([{ channelId: "ch-1" }]);
      mockPrisma.conversation.findFirst.mockResolvedValue(null);

      await expect(
        service.findMessagesPage("t-1", "c-secret", { limit: 10 }, agentUser),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.conversation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "c-secret",
            tenantId: "t-1",
            channelId: { in: ["ch-1"] },
          },
        }),
      );
    });
  });

  describe("sendOperatorMessage", () => {
    it("sets sentByUserId and isFromAi false on human reply", async () => {
      mockPrisma.whatsappChannelMember.findMany.mockResolvedValue([{ channelId: "ch-1" }]);
      mockPrisma.conversation.findFirst.mockResolvedValue({
        id: "c-1",
        status: "HUMAN_HANDOFF",
        channelId: "ch-1",
        contact: { phone: "5511" },
        tenant: { whatsappPhoneId: "phone-1", metaAccessToken: "token" },
      });
      mockPrisma.message.create.mockResolvedValue({
        id: "m-1",
        sentAt: new Date(),
      });
      mockPrisma.conversation.update.mockResolvedValue({});
      mockPrisma.message.update.mockResolvedValue({});

      const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [{ id: "wa-1" }] }),
      } as Response);

      await service.sendOperatorMessage("t-1", "c-1", agentUser, "Olá cliente");

      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isFromAi: false,
          sentByUserId: "u-agent",
          text: "Olá cliente",
          direction: "OUTBOUND",
        }),
      });

      fetchSpy.mockRestore();
    });
  });

  it("throws when conversation is outside tenant", async () => {
    mockPrisma.conversation.findFirst.mockResolvedValue(null);

    await expect(service.findMessagesPage("t-1", "bad", { limit: 50 }, ownerUser)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("returns messages with normalized direction", async () => {
    const now = new Date();
    mockPrisma.conversation.findFirst.mockResolvedValue({ id: "c-1" });
    mockPrisma.message.findMany.mockResolvedValue([
      {
        id: "m-1",
        conversationId: "c-1",
        waMessageId: "wa-1",
        direction: "OUTBOUND",
        type: "TEXT",
        text: "Olá",
        imageUrl: null,
        audioUrl: null,
        documentUrl: null,
        documentName: null,
        sentAt: now,
        isFromAi: true,
        deliveredAt: now,
        readAt: null,
        failedAt: null,
      },
    ]);

    const page = await service.findMessagesPage("t-1", "c-1", { limit: 50 }, ownerUser);
    expect(page.messages[0]!.direction).toBe("outbound");
    expect(page.messages[0]!.messageStatus).toBe("delivered");
  });

  describe("findMessagesPage", () => {
    function row(id: string, sentAt: Date) {
      return {
        id,
        conversationId: "c-1",
        waMessageId: null,
        direction: "INBOUND",
        type: "TEXT",
        text: id,
        imageUrl: null,
        audioUrl: null,
        documentUrl: null,
        documentName: null,
        sentAt,
        isFromAi: false,
        deliveredAt: null,
        readAt: null,
        failedAt: null,
      };
    }

    it("throws when conversation is outside tenant", async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue(null);
      await expect(
        service.findMessagesPage("t-1", "bad", { limit: 10 }, ownerUser),
      ).rejects.toThrow(NotFoundException);
    });

    it("retorna página em ordem asc, hasMore=false quando não há mais", async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue({ id: "c-1" });
      // limit=2 → pede take=3 (limit+1). Só 2 vieram → não há mais.
      mockPrisma.message.findMany.mockResolvedValue([
        row("m-2", new Date("2026-01-02")),
        row("m-1", new Date("2026-01-01")),
      ]);

      const page = await service.findMessagesPage("t-1", "c-1", { limit: 2 }, ownerUser);

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { sentAt: "desc" }, take: 3 }),
      );
      expect(page.hasMore).toBe(false);
      expect(page.nextCursor).toBeNull();
      expect(page.messages.map((m) => m.id)).toEqual(["m-1", "m-2"]);
    });

    it("detecta hasMore e emite nextCursor da mais antiga da página", async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue({ id: "c-1" });
      // limit=2 → take=3; 3 vieram → há mais. A 3ª (mais antiga) é descartada.
      mockPrisma.message.findMany.mockResolvedValue([
        row("m-3", new Date("2026-01-03")),
        row("m-2", new Date("2026-01-02")),
        row("m-1", new Date("2026-01-01")),
      ]);

      const page = await service.findMessagesPage("t-1", "c-1", { limit: 2 }, ownerUser);

      expect(page.hasMore).toBe(true);
      // página = 2 mais recentes [m-3, m-2]; asc → [m-2, m-3]; cursor = m-2 (mais antiga da página).
      expect(page.messages.map((m) => m.id)).toEqual(["m-2", "m-3"]);
      expect(page.nextCursor).toBe(new Date("2026-01-02").toISOString());
    });

    it("aplica filtro sentAt < before quando cursor é passado", async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue({ id: "c-1" });
      mockPrisma.message.findMany.mockResolvedValue([]);

      await service.findMessagesPage(
        "t-1",
        "c-1",
        {
          limit: 10,
          before: "2026-01-02T00:00:00.000Z",
        },
        ownerUser,
      );

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sentAt: { lt: new Date("2026-01-02T00:00:00.000Z") },
          }),
        }),
      );
    });
  });
});
