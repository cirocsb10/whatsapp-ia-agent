import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AgentConfigService } from "./agent-config.service";

@Injectable()
export class ChatSimulatorService {
  constructor(
    private readonly config: ConfigService,
    private readonly agentConfig: AgentConfigService,
  ) {}

  async reply(tenantId: string, message: string) {
    const cfg = await this.agentConfig.getConfig(tenantId);
    const apiKey = this.config.get<string>("OPENAI_API_KEY");

    if (!apiKey) {
      return {
        reply: `${cfg.agentName}: recebi "${message}". Configure OPENAI_API_KEY para respostas reais.`,
      };
    }

    try {
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.llmModel,
          input: [
            {
              role: "system",
              content:
                cfg.systemPromptBase ??
                `Voce e ${cfg.agentName}, um atendente de WhatsApp com tom ${cfg.tone}. Responda de forma objetiva em portugues do Brasil.`,
            },
            { role: "user", content: message },
          ],
          temperature: cfg.llmTemperature,
          max_output_tokens: cfg.maxResponseLength,
        }),
      });

      if (!res.ok) throw new Error(`OpenAI request failed: ${res.status}`);
      const body: any = await res.json();
      const reply =
        body.output_text ??
        body.output?.flatMap((item: any) => item.content ?? [])
          ?.map((item: any) => item.text)
          ?.filter(Boolean)
          ?.join("\n");

      return { reply: reply || "Nao consegui gerar uma resposta agora." };
    } catch {
      return {
        reply: `${cfg.agentName}: nao consegui acessar o modelo agora, mas recebi sua mensagem.`,
      };
    }
  }
}
