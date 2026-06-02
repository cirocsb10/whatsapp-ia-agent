import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AgentConfigService } from "./agent-config.service";

@Injectable()
export class ChatSimulatorService {
  private readonly logger = new Logger(ChatSimulatorService.name);
  private readonly configCache = new Map<string, { config: any; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 60_000;

  constructor(
    private readonly config: ConfigService,
    private readonly agentConfig: AgentConfigService,
  ) {}

  private async getCachedConfig(tenantId: string) {
    const cached = this.configCache.get(tenantId);
    if (cached && Date.now() < cached.expiresAt) return cached.config;
    const config = await this.agentConfig.getConfig(tenantId);
    this.configCache.set(tenantId, { config, expiresAt: Date.now() + this.CACHE_TTL_MS });
    return config;
  }

  async reply(tenantId: string, message: string) {
    const cfg = await this.getCachedConfig(tenantId);
    const apiKey = this.config.get<string>("OPENAI_API_KEY");

    if (!apiKey) {
      return {
        reply: `${cfg.agentName}: recebi "${message}". Configure OPENAI_API_KEY para respostas reais.`,
      };
    }

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.llmModel,
          messages: [
            {
              role: "system",
              content:
                cfg.systemPromptBase ??
                `Voce e ${cfg.agentName}, um atendente de WhatsApp com tom ${cfg.tone}. Responda de forma objetiva em portugues do Brasil.`,
            },
            { role: "user", content: message },
          ],
          temperature: cfg.llmTemperature,
          max_tokens: cfg.maxResponseLength,
        }),
      });

      if (!res.ok) throw new Error(`OpenAI request failed: ${res.status}`);
      const body: any = await res.json();
      const reply = body.choices[0]?.message?.content;

      return { reply: reply || "Nao consegui gerar uma resposta agora." };
    } catch (err) {
      this.logger.error("OpenAI chat request failed", err);
      return {
        reply: `${cfg.agentName}: nao consegui acessar o modelo agora, mas recebi sua mensagem.`,
      };
    }
  }
}
