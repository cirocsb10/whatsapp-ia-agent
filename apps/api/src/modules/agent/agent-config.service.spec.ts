import { Test } from "@nestjs/testing";
import { PrismaService } from "../../common/prisma/prisma.service";
import { AgentConfigService } from "./agent-config.service";

const mockPrisma = {
  agentConfig: { upsert: jest.fn() },
};

describe("AgentConfigService", () => {
  let service: AgentConfigService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AgentConfigService, { provide: PrismaService, useValue: mockPrisma }],
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
});
