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

  it("calls correct OpenAI endpoint and extracts reply from choices", async () => {
    mockConfig.get.mockReturnValue("sk-test-key");
    mockAgentConfig.getConfig.mockResolvedValue({
      agentName: "Bot",
      llmModel: "gpt-4o-mini",
      systemPromptBase: "Voce e um assistente.",
      llmTemperature: 0.7,
      maxResponseLength: 500,
      tone: "formal",
    });

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Olá! Como posso ajudar?" } }],
      }),
    });
    globalThis.fetch = mockFetch as any;

    const result = await service.reply("t-1", "Oi");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"messages"'),
      }),
    );

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody.messages).toBeDefined();
    expect(requestBody.max_tokens).toBeDefined();
    expect(requestBody).not.toHaveProperty("input");
    expect(requestBody).not.toHaveProperty("max_output_tokens");

    expect(result.reply).toBe("Olá! Como posso ajudar?");
  });
});
