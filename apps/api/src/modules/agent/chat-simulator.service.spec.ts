import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AgentConfigService } from "./agent-config.service";
import { ChatSimulatorService } from "./chat-simulator.service";

describe("ChatSimulatorService", () => {
  let service: ChatSimulatorService;
  const mockConfig = { get: jest.fn() };
  const mockAgentConfig = { getConfig: jest.fn() };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ChatSimulatorService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: AgentConfigService, useValue: mockAgentConfig },
      ],
    }).compile();
    service = module.get(ChatSimulatorService);
    jest.clearAllMocks();
  });

  it("returns local fallback when OPENAI_API_KEY is missing", async () => {
    mockConfig.get.mockReturnValue(undefined);
    mockAgentConfig.getConfig.mockResolvedValue({ agentName: "Bot" });

    const result = await service.reply("t-1", "Oi");

    expect(result.reply).toContain("Bot");
    expect(result.reply).toContain("Oi");
  });
});
