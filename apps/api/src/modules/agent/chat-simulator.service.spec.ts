import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AgentConfigService } from "./agent-config.service";
import { ChatSimulatorService } from "./chat-simulator.service";

describe("ChatSimulatorService", () => {
  let service: ChatSimulatorService;
  const mockConfig = { get: jest.fn() };
  const mockAgentConfig = { getConfig: jest.fn() };
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    originalFetch = globalThis.fetch;
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

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns local fallback when OPENAI_API_KEY and orchestrator are missing", async () => {
    mockConfig.get.mockReturnValue(undefined);
    mockAgentConfig.getConfig.mockResolvedValue({ agentName: "Bot" });

    const result = await service.reply("t-1", "Oi");

    expect(result.reply).toContain("Bot");
    expect(result.reply).toContain("Oi");
  });

  it("prefers orchestrator simulate when available", async () => {
    mockConfig.get.mockImplementation((key: string) => {
      if (key === "AI_ORCHESTRATOR_URL") return "http://orchestrator:8000";
      if (key === "INTERNAL_API_TOKEN") return "secret";
      return undefined;
    });

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: "Resposta do LangGraph" }),
    });
    globalThis.fetch = mockFetch as any;

    const result = await service.reply("t-1", "Oi");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://orchestrator:8000/internal/simulate",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.reply).toBe("Resposta do LangGraph");
  });

  it("falls back to OpenAI when orchestrator is unavailable", async () => {
    mockConfig.get.mockImplementation((key: string) => {
      if (key === "OPENAI_API_KEY") return "sk-test-key";
      return undefined;
    });
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
