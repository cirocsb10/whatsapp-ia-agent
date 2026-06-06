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
});
