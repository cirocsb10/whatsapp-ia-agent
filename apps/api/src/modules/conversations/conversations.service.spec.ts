import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaService } from "../../common/prisma/prisma.service";
import { ConversationsService } from "./conversations.service";

const mockPrisma = {
  conversation: { findMany: jest.fn(), findFirst: jest.fn() },
  message: { findMany: jest.fn() },
};

describe("ConversationsService", () => {
  let service: ConversationsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ConversationsService, { provide: PrismaService, useValue: mockPrisma }],
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
        messages: [{ text: "Oi", sentAt: now, type: "TEXT" }],
      },
    ]);

    await expect(service.findAll("t-1")).resolves.toEqual([
      expect.objectContaining({ id: "c-1", lastMessage: "Oi", unreadCount: 0 }),
    ]);
  });

  it("throws when conversation is outside tenant", async () => {
    mockPrisma.conversation.findFirst.mockResolvedValue(null);

    await expect(service.findMessages("t-1", "bad")).rejects.toThrow(NotFoundException);
  });
});
