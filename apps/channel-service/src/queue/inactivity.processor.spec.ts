import { Test, TestingModule } from "@nestjs/testing";
import { Job } from "bullmq";
import { InactivityProcessor } from "./inactivity.processor";
import { InactivitySchedulerService } from "./inactivity-scheduler.service";
import { MessagingService } from "../messaging/messaging.service";
import { PrismaService } from "../prisma/prisma.service";
import { SessionService } from "../session/session.service";
import { InactivityJobData } from "./inactivity.types";
import { CLOSE_GRACE_MINUTES } from "./queue.constants";

const baseJobData: InactivityJobData = {
  conversationId: "conv-1",
  tenantId: "tenant-1",
  contactPhone: "5511999990000",
  waPhoneId: "phone-001",
  phase: "warn",
  scheduledAt: Date.now() - 60_000,
};

const mockPrisma = {
  conversation: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  agentConfig: {
    findUnique: jest.fn(),
  },
};

const mockMessaging = { sendMessage: jest.fn().mockResolvedValue("wa-id") };
const mockScheduler = {
  scheduleClose: jest.fn().mockResolvedValue(undefined),
};
const mockSession = { deleteSession: jest.fn().mockResolvedValue(undefined) };

function makeJob(data: InactivityJobData): Job<InactivityJobData> {
  return { data } as Job<InactivityJobData>;
}

describe("InactivityProcessor", () => {
  let processor: InactivityProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InactivityProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MessagingService, useValue: mockMessaging },
        { provide: InactivitySchedulerService, useValue: mockScheduler },
        { provide: SessionService, useValue: mockSession },
      ],
    }).compile();

    processor = module.get(InactivityProcessor);
    jest.clearAllMocks();

    mockPrisma.conversation.findFirst.mockResolvedValue({
      lastMessageAt: new Date(baseJobData.scheduledAt - 1000),
    });
    mockPrisma.agentConfig.findUnique.mockResolvedValue({
      inactivityMessage: "Ainda está por aqui?",
      closingMessage: "Até logo!",
      inactivityTimeoutMin: 30,
    });
  });

  it("warn phase sends inactivityMessage and schedules close", async () => {
    await processor.process(makeJob({ ...baseJobData, phase: "warn" }));

    expect(mockMessaging.sendMessage).toHaveBeenCalledWith(
      "phone-001",
      "5511999990000",
      { type: "text", text: "Ainda está por aqui?" },
    );
    expect(mockScheduler.scheduleClose).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "warn" }),
      CLOSE_GRACE_MINUTES * 60_000,
    );
    expect(mockPrisma.conversation.update).not.toHaveBeenCalled();
  });

  it("close phase sends closingMessage, closes conversation and deletes session", async () => {
    await processor.process(makeJob({ ...baseJobData, phase: "close" }));

    expect(mockMessaging.sendMessage).toHaveBeenCalledWith(
      "phone-001",
      "5511999990000",
      { type: "text", text: "Até logo!" },
    );
    expect(mockPrisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "conv-1" },
      data: { status: "CLOSED", closedAt: expect.any(Date) },
    });
    expect(mockSession.deleteSession).toHaveBeenCalledWith("tenant-1", "5511999990000");
    expect(mockScheduler.scheduleClose).not.toHaveBeenCalled();
  });

  it("skips when conversation is not ACTIVE", async () => {
    mockPrisma.conversation.findFirst.mockResolvedValue(null);

    await processor.process(makeJob(baseJobData));

    expect(mockMessaging.sendMessage).not.toHaveBeenCalled();
  });

  it("skips when a new message arrived after scheduling", async () => {
    mockPrisma.conversation.findFirst.mockResolvedValue({
      lastMessageAt: new Date(baseJobData.scheduledAt + 1000),
    });

    await processor.process(makeJob(baseJobData));

    expect(mockMessaging.sendMessage).not.toHaveBeenCalled();
  });
});
