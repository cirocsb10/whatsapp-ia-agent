"use client";
import { MessageCircle } from "lucide-react";
import type { FormState, PatchFn } from "@/features/agent/model/persona-form";

interface Props {
  form: FormState;
  patch: PatchFn;
  loading: boolean;
}

const FIELDS = [
  {
    key: "greetingMessage" as const,
    label: "Boas-vindas",
    hint: "Primeira mensagem ao iniciar conversa",
    rows: 7,
  },
  {
    key: "inactivityMessage" as const,
    label: "Inatividade",
    hint: "Quando o cliente para de responder",
    rows: 5,
  },
  {
    key: "closingMessage" as const,
    label: "Encerramento",
    hint: "Ao finalizar o atendimento",
    rows: 5,
  },
];

export function MessagesSection({ form, patch, loading }: Props) {
  return (
    <section className="persona-card">
      <div className="persona-card-head">
        <div className="persona-card-icon persona-card-icon--cyan">
          <MessageCircle className="w-4 h-4" strokeWidth={1.8} />
        </div>
        <div>
          <p className="persona-card-title">Mensagens automáticas</p>
          <p className="persona-card-sub">Saudação, inatividade e encerramento</p>
        </div>
      </div>

      <div className="persona-card-body persona-card-body--stack">
        {FIELDS.map(({ key, label, hint, rows }) => (
          <label key={key} className="form-field">
            <span className="form-label">
              {label}
              <span className="form-label-hint"> — {hint}</span>
            </span>
            <textarea
              value={form[key]}
              onChange={(e) => patch(key, e.target.value)}
              rows={rows}
              className="form-input"
              disabled={loading}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
