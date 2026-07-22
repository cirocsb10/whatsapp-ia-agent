"use client";
import { Bot, Cpu, Thermometer, Zap } from "lucide-react";
import { tempLabel } from "@/lib/persona";
import { FIXED_LLM_MODEL, TONES, type FormState } from "@/features/agent/model/persona-form";

interface Props {
  form: FormState;
  previewTime: string;
}

export function PersonaPreview({ form, previewTime }: Props) {
  const toneMeta = TONES.find((t) => t.value === form.tone) ?? TONES[2];

  return (
    <aside className="persona-preview-col">
      <div className="persona-preview-sticky">
        <div className="persona-preview-head">
          <Zap className="w-3.5 h-3.5 text-amber-400" strokeWidth={2} />
          <span>Preview ao vivo</span>
        </div>

        <div className="persona-phone">
          <div className="persona-phone-notch" aria-hidden="true" />
          <div className="persona-phone-header">
            <div className="persona-phone-avatar">
              <Bot className="w-4 h-4 text-indigo-300" strokeWidth={1.5} />
            </div>
            <div className="persona-phone-contact">
              <p className="persona-phone-name">{form.agentName || "Assistente"}</p>
              <p className="persona-phone-status">online · {toneMeta.label.toLowerCase()}</p>
            </div>
          </div>

          <div className="persona-phone-chat">
            <div className="persona-chat-date">Hoje</div>

            <div className="persona-bubble persona-bubble--in">
              <p>{form.greetingMessage || "Olá! Como posso ajudar?"}</p>
              <span className="persona-bubble-time">{previewTime}</span>
            </div>

            <div className="persona-bubble persona-bubble--out">
              <p>Quero saber mais sobre os produtos</p>
              <span className="persona-bubble-time">{previewTime}</span>
            </div>

            <div className="persona-bubble persona-bubble--in">
              <p>
                Claro! Estou aqui para ajudar com qualquer dúvida sobre nossos produtos.
                O que você gostaria de saber?
              </p>
              <span className="persona-bubble-time">{previewTime}</span>
            </div>

            {form.inactivityMessage && (
              <div className="persona-chat-hint">
                <span>Inatividade:</span> {form.inactivityMessage}
              </div>
            )}
          </div>

          <div className="persona-phone-input" aria-hidden="true">
            <span>Digite uma mensagem</span>
          </div>
        </div>

        <div className="persona-preview-meta">
          <div className="persona-meta-chip">
            <Cpu className="w-3 h-3" />
            {FIXED_LLM_MODEL.label}
          </div>
          <div className="persona-meta-chip">
            <Thermometer className="w-3 h-3" />
            {tempLabel(form.llmTemperature)}
          </div>
          <div className="persona-meta-chip">
            max {form.maxResponseLength} chars
          </div>
        </div>
      </div>
    </aside>
  );
}
