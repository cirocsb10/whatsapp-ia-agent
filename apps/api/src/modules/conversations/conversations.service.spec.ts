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
  handoffEvent: { create: jest.fn(), updateMany: jest.fn() },
  $transaction: jest.fn(),
};

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

    await expect(service.findAll("t-1")).resolves.toEqual([
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

    const result = await service.findAll("t-1");
    expect(result[0]!.lastMessage).toBe("[midia]");
  });

  it("throws when conversation is outside tenant", async () => {
    mockPrisma.conversation.findFirst.mockResolvedValue(null);

    await expect(service.findMessages("t-1", "bad")).rejects.toThrow(NotFoundException);
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

    const msgs = await service.findMessages("t-1", "c-1");
    expect(msgs[0]!.direction).toBe("outbound");
    expect(msgs[0]!.messageStatus).toBe("delivered");
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
        service.findMessagesPage("t-1", "bad", { limit: 10 }),
      ).rejects.toThrow(NotFoundException);
    });

    it("retorna página em ordem asc, hasMore=false quando não há mais", async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue({ id: "c-1" });
      // limit=2 → pede take=3 (limit+1). Só 2 vieram → não há mais.
      mockPrisma.message.findMany.mockResolvedValue([
        row("m-2", new Date("2026-01-02")),
        row("m-1", new Date("2026-01-01")),
      ]);

      const page = await service.findMessagesPage("t-1", "c-1", { limit: 2 });

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

      const page = await service.findMessagesPage("t-1", "c-1", { limit: 2 });

      expect(page.hasMore).toBe(true);
      // página = 2 mais recentes [m-3, m-2]; asc → [m-2, m-3]; cursor = m-2 (mais antiga da página).
      expect(page.messages.map((m) => m.id)).toEqual(["m-2", "m-3"]);
      expect(page.nextCursor).toBe(new Date("2026-01-02").toISOString());
    });

    it("aplica filtro sentAt < before quando cursor é passado", async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue({ id: "c-1" });
      mockPrisma.message.findMany.mockResolvedValue([]);

      await service.findMessagesPage("t-1", "c-1", {
        limit: 10,
        before: "2026-01-02T00:00:00.000Z",
      });

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
