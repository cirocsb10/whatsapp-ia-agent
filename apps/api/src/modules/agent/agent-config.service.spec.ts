import { Test } from "@nestjs/testing";
import { PrismaService } from "../../common/prisma/prisma.service";
import { AgentConfigService } from "./agent-config.service";

const mockPrisma = {
  agentConfig: { upsert: jest.fn() },
};

const mockRedis = { del: jest.fn() };

describe("AgentConfigService", () => {
  let service: AgentConfigService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AgentConfigService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: "REDIS_CLIENT", useValue: mockRedis },
      ],
    }).compile();
    service = module.get(AgentConfigService);
    jest.clearAllMocks();
  });

  it("upserts default config on read", async () => {
    mockPrisma.agentConfig.upsert.mockResolvedValue({ tenantId: "t-1", agentName: "Assistente" });

    await expect(service.getConfig("t-1")).resolves.toMatchObject({ agentName: "Assistente" });
    expect(mockPrisma.agentConfig.upsert).toHaveBeenCalledWith({
      where: { tenantId: "t-1" },
      create: { tenantId: "t-1" },
      update: {},
    });
  });

  it("clears publishedAt when isPublished is set to false", async () => {
    mockPrisma.agentConfig.upsert.mockResolvedValue({ tenantId: "t-1", isPublished: false, publishedAt: null });
    await service.updateConfig("t-1", { isPublished: false });
    const upsertCall = mockPrisma.agentConfig.upsert.mock.calls[0][0];
    expect(upsertCall.update.publishedAt).toBeNull();
  });

  it("sets publishedAt when publishing", async () => {
    mockPrisma.agentConfig.upsert.mockResolvedValue({ tenantId: "t-1", isPublished: true });

    await service.updateConfig("t-1", { agentName: "Bot", isPublished: true });

    expect(mockPrisma.agentConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t-1" },
        update: expect.objectContaining({ agentName: "Bot", isPublished: true, publishedAt: expect.any(Date) }),
      }),
    );
  });

  it("deletes Redis cache key when isPublished is set to true", async () => {
    mockPrisma.agentConfig.upsert.mockResolvedValue({ tenantId: "t-1", isPublished: true });

    await service.updateConfig("t-1", { isPublished: true });

    expect(mockRedis.del).toHaveBeenCalledWith("agent:published:t-1");
  });

  it("deletes Redis cache key when isPublished is set to false", async () => {
    mockPrisma.agentConfig.upsert.mockResolvedValue({ tenantId: "t-1", isPublished: false, publishedAt: null });

    await service.updateConfig("t-1", { isPublished: false });

    expect(mockRedis.del).toHaveBeenCalledWith("agent:published:t-1");
  });

  it("does not delete Redis cache when isPublished is not in dto", async () => {
    mockPrisma.agentConfig.upsert.mockResolvedValue({ tenantId: "t-1", agentName: "Bot" });

    await service.updateConfig("t-1", { agentName: "Bot" });

    expect(mockRedis.del).not.toHaveBeenCalled();
  });

  describe("atendimento & handoff fields", () => {
    it("passes handoffMessage and outOfHoursMessage through to Prisma", async () => {
      mockPrisma.agentConfig.upsert.mockResolvedValue({ tenantId: "t-1" });

      await service.updateConfig("t-1", {
        handoffMessage: "Transferindo para atendente.",
        outOfHoursMessage: "Fora do horário, retornamos amanhã.",
      });

      const upsertCall = mockPrisma.agentConfig.upsert.mock.calls[0][0];
      expect(upsertCall.update.handoffMessage).toBe("Transferindo para atendente.");
      expect(upsertCall.update.outOfHoursMessage).toBe("Fora do horário, retornamos amanhã.");
    });

    it("passes autoHandoffThreshold through to Prisma", async () => {
      mockPrisma.agentConfig.upsert.mockResolvedValue({ tenantId: "t-1" });

      await service.updateConfig("t-1", { autoHandoffThreshold: 0.6 });

      const upsertCall = mockPrisma.agentConfig.upsert.mock.calls[0][0];
      expect(upsertCall.update.autoHandoffThreshold).toBe(0.6);
    });

    it("passes null handoffOrderValueBrl through to Prisma", async () => {
      mockPrisma.agentConfig.upsert.mockResolvedValue({ tenantId: "t-1" });

      await service.updateConfig("t-1", { handoffOrderValueBrl: null });

      const upsertCall = mockPrisma.agentConfig.upsert.mock.calls[0][0];
      expect(upsertCall.update.handoffOrderValueBrl).toBeNull();
    });

    it("passes numeric handoffOrderValueBrl through to Prisma", async () => {
      mockPrisma.agentConfig.upsert.mockResolvedValue({ tenantId: "t-1" });

      await service.updateConfig("t-1", { handoffOrderValueBrl: 499.9 });

      const upsertCall = mockPrisma.agentConfig.upsert.mock.calls[0][0];
      expect(upsertCall.update.handoffOrderValueBrl).toBe(499.9);
    });

    it("passes session and conversation limits through to Prisma", async () => {
      mockPrisma.agentConfig.upsert.mockResolvedValue({ tenantId: "t-1" });

      await service.updateConfig("t-1", {
        inactivityTimeoutMin: 45,
        sessionTtlHours: 48,
        maxConversationLength: 75,
      });

      const upsertCall = mockPrisma.agentConfig.upsert.mock.calls[0][0];
      expect(upsertCall.update.inactivityTimeoutMin).toBe(45);
      expect(upsertCall.update.sessionTtlHours).toBe(48);
      expect(upsertCall.update.maxConversationLength).toBe(75);
    });

    it("passes businessHours JSON object through to Prisma", async () => {
      mockPrisma.agentConfig.upsert.mockResolvedValue({ tenantId: "t-1" });

      const schedule = {
        monday: { enabled: true, start: "08:00", end: "17:00" },
        saturday: { enabled: false, start: "09:00", end: "12:00" },
      };

      await service.updateConfig("t-1", { businessHours: schedule });

      const upsertCall = mockPrisma.agentConfig.upsert.mock.calls[0][0];
      expect(upsertCall.update.businessHours).toEqual(schedule);
    });

    it("does not invalidate Redis cache when only atendimento fields are updated", async () => {
      mockPrisma.agentConfig.upsert.mockResolvedValue({ tenantId: "t-1" });

      await service.updateConfig("t-1", {
        handoffMessage: "Transferindo…",
        inactivityTimeoutMin: 20,
        businessHours: { monday: { enabled: true, start: "09:00", end: "18:00" } },
      });

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });
});
