"use client";
import { UserCheck } from "lucide-react";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { NumericInput } from "@/components/ui/NumericInput";
import type { FormState, PatchFn } from "@/features/agent/model/persona-form";

interface Props {
  form: FormState;
  patch: PatchFn;
  loading: boolean;
}

export function HandoffSection({ form, patch, loading }: Props) {
  return (
    <section className="persona-card">
      <div className="persona-card-head">
        <div className="persona-card-icon persona-card-icon--indigo">
          <UserCheck className="w-4 h-4" strokeWidth={1.8} />
        </div>
        <div>
          <p className="persona-card-title">Atendimento & Handoff</p>
          <p className="persona-card-sub">Tempos de sessão e transferência humana</p>
        </div>
      </div>

      <div className="persona-card-body persona-card-body--stack">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <label className="form-field">
            <span className="form-label">
              Inatividade
              <span className="form-label-hint"> — min</span>
            </span>
            <NumericInput
              value={String(form.inactivityTimeoutMin)}
              onChange={(v) => {
                if (v !== "") patch("inactivityTimeoutMin", Number(v));
              }}
              disabled={loading}
            />
          </label>
          <label className="form-field">
            <span className="form-label">
              Sessão
              <span className="form-label-hint"> — horas</span>
            </span>
            <NumericInput
              value={String(form.sessionTtlHours)}
              onChange={(v) => {
                if (v !== "") patch("sessionTtlHours", Number(v));
              }}
              disabled={loading}
            />
          </label>
          <label className="form-field">
            <span className="form-label">Max. turnos</span>
            <NumericInput
              value={String(form.maxConversationLength)}
              onChange={(v) => {
                if (v !== "") patch("maxConversationLength", Number(v));
              }}
              disabled={loading}
            />
          </label>
        </div>

        <div className="form-field">
          <div className="persona-slider-head">
            <span className="form-label">Limite de confiança para handoff</span>
            <span className="persona-slider-value">
              {form.autoHandoffThreshold.toFixed(2)}
              <span className="persona-slider-tag">
                {form.autoHandoffThreshold <= 0.2 ? "Raro" : form.autoHandoffThreshold <= 0.5 ? "Moderado" : "Frequente"}
              </span>
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={form.autoHandoffThreshold}
            onChange={(e) => patch("autoHandoffThreshold", Number(e.target.value))}
            className="persona-range"
            style={{ "--range-pct": `${form.autoHandoffThreshold * 100}%` } as React.CSSProperties}
            disabled={loading}
            aria-label="Limite de confiança para handoff"
          />
          <div className="persona-range-labels">
            <span>Raro</span>
            <span>Moderado</span>
            <span>Frequente</span>
          </div>
        </div>

        <label className="form-field">
          <span className="form-label">
            Valor mínimo para handoff (R$)
            <span className="form-label-hint"> — deixe vazio para desativar</span>
          </span>
          <DecimalInput
            value={form.handoffOrderValueBrl}
            onChange={(v) => patch("handoffOrderValueBrl", v)}
            placeholder="0,00"
            disabled={loading}
          />
        </label>

        <label className="form-field">
          <span className="form-label">
            Mensagem de handoff
            <span className="form-label-hint"> — exibida ao transferir para humano</span>
          </span>
          <textarea
            value={form.handoffMessage}
            onChange={(e) => patch("handoffMessage", e.target.value)}
            rows={5}
            className="form-input"
            disabled={loading}
          />
        </label>

        <label className="form-field">
          <span className="form-label">
            Mensagem fora do horário
            <span className="form-label-hint"> — quando o agente está fechado</span>
          </span>
          <textarea
            value={form.outOfHoursMessage}
            onChange={(e) => patch("outOfHoursMessage", e.target.value)}
            rows={5}
            className="form-input"
            disabled={loading}
          />
        </label>
      </div>
    </section>
  );
}
