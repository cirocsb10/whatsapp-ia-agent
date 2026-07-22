"use client";
import { Bot } from "lucide-react";
import { TONES, type FormState, type PatchFn } from "@/features/agent/model/persona-form";

interface Props {
  form: FormState;
  patch: PatchFn;
  loading: boolean;
}

export function IdentitySection({ form, patch, loading }: Props) {
  const toneMeta = TONES.find((t) => t.value === form.tone) ?? TONES[2];

  return (
    <section className="persona-card">
      <div className="persona-card-head">
        <div className="persona-card-icon persona-card-icon--indigo">
          <Bot className="w-4 h-4" strokeWidth={1.8} />
        </div>
        <div>
          <p className="persona-card-title">Identidade</p>
          <p className="persona-card-sub">Nome e personalidade base</p>
        </div>
      </div>

      <div className="persona-card-body">
        <label className="form-field">
          <span className="form-label">Nome do agente</span>
          <input
            value={form.agentName}
            onChange={(e) => patch("agentName", e.target.value)}
            placeholder="Ex: Ana, Assistente Virtual…"
            className="form-input"
            disabled={loading}
          />
        </label>

        <div className="form-field">
          <span className="form-label">
            Tom de voz
            <span className="form-label-hint"> — {toneMeta.desc}</span>
          </span>
          <div className="persona-tone-grid" role="radiogroup" aria-label="Tom de voz">
            {TONES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={form.tone === value}
                onClick={() => patch("tone", value)}
                className={`persona-tone-pill ${form.tone === value ? "persona-tone-pill--active" : ""}`}
                disabled={loading}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
