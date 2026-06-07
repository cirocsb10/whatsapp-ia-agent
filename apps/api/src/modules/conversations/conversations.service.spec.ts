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
});
