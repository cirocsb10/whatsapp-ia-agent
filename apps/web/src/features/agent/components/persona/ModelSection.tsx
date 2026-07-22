"use client";
import { Cpu, Thermometer } from "lucide-react";
import { NumericInput } from "@/components/ui/NumericInput";
import { tempLabel } from "@/lib/persona";
import { FIXED_LLM_MODEL, type FormState, type PatchFn } from "@/features/agent/model/persona-form";

interface Props {
  form: FormState;
  patch: PatchFn;
  loading: boolean;
}

export function ModelSection({ form, patch, loading }: Props) {
  return (
    <section className="persona-card">
      <div className="persona-card-head">
        <div className="persona-card-icon persona-card-icon--green">
          <Cpu className="w-4 h-4" strokeWidth={1.8} />
        </div>
        <div>
          <p className="persona-card-title">Modelo de IA</p>
          <p className="persona-card-sub">Criatividade e limites de resposta</p>
        </div>
      </div>

      <div className="persona-card-body">
        <div className="form-field">
          <span className="form-label">Modelo LLM</span>
          <div className="persona-model-fixed">
            <span className="persona-model-fixed-name">{FIXED_LLM_MODEL.label}</span>
            <span className="persona-model-fixed-sep">—</span>
            <span className="persona-model-fixed-desc">{FIXED_LLM_MODEL.desc}</span>
          </div>
        </div>

        <div className="form-field">
          <div className="persona-slider-head">
            <span className="form-label">
              <Thermometer className="w-3 h-3 inline -mt-0.5 mr-1 opacity-60" />
              Temperatura
            </span>
            <span className="persona-slider-value">
              {form.llmTemperature.toFixed(1)}
              <span className="persona-slider-tag">{tempLabel(form.llmTemperature)}</span>
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={form.llmTemperature}
            onChange={(e) => patch("llmTemperature", Number(e.target.value))}
            className="persona-range"
            style={{ "--range-pct": `${(form.llmTemperature / 2) * 100}%` } as React.CSSProperties}
            disabled={loading}
            aria-label="Temperatura do modelo"
          />
          <div className="persona-range-labels">
            <span>Preciso</span>
            <span>Equilibrado</span>
            <span>Criativo</span>
          </div>
        </div>

        <label className="form-field">
          <span className="form-label">
            Tamanho máximo da resposta
            <span className="form-label-hint"> — caracteres</span>
          </span>
          <NumericInput
            value={String(form.maxResponseLength)}
            onChange={(v) => {
              if (v !== "") patch("maxResponseLength", Number(v));
            }}
            disabled={loading}
          />
        </label>

        <label className="form-field">
          <span className="form-label">
            Prompt de sistema
            <span className="form-label-hint"> — instruções base para o LLM</span>
          </span>
          <textarea
            value={form.systemPromptBase ?? ""}
            onChange={(e) => patch("systemPromptBase", e.target.value)}
            rows={30}
            placeholder="Ex: Você é um assistente de vendas da loja X. Seja sempre cordial…"
            className="form-input form-input-mono"
            disabled={loading}
          />
        </label>
      </div>
    </section>
  );
}
