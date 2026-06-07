"use client";

import { DecimalInput } from "@/components/ui/DecimalInput";
import { Header } from "@/components/layout/Header";
import { NumericInput } from "@/components/ui/NumericInput";
import { TimeInput } from "@/components/ui/TimeInput";
import { useApi } from "@/lib/hooks/useApi";
import { centsToMaskedPrice, maskedPriceToCents } from "@/lib/decimal-mask";
import {
  DAYS,
  DEFAULT_BUSINESS_HOURS,
  normalizeBusinessHours,
  tempLabel,
  type BusinessHoursDay,
  type BusinessHoursMap,
} from "@/lib/persona";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Clock,
  MessageCircle,
  Sparkles,
  Cpu,
  Thermometer,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  Zap,
} from "lucide-react";

const TONES = [
  { value: "FORMAL", label: "Formal", desc: "Profissional e objetivo" },
  { value: "INFORMAL", label: "Informal", desc: "Descontraído e leve" },
  { value: "FRIENDLY", label: "Amigável", desc: "Acolhedor e empático" },
  { value: "TECHNICAL", label: "Técnico", desc: "Preciso e detalhado" },
  { value: "REGIONAL", label: "Regional", desc: "Linguagem local" },
] as const;

const FIXED_LLM_MODEL = {
  value: "gpt-4o-mini",
  label: "GPT-4o Mini",
  desc: "Rápido e econômico",
} as const;


type FormState = {
  agentName: string;
  tone: string;
  greetingMessage: string;
  inactivityMessage: string;
  closingMessage: string;
  outOfHoursMessage: string;
  handoffMessage: string;
  autoHandoffThreshold: number;
  handoffOrderValueBrl: string;
  inactivityTimeoutMin: number;
  sessionTtlHours: number;
  maxConversationLength: number;
  businessHours: BusinessHoursMap;
  llmModel: string;
  llmTemperature: number;
  maxResponseLength: number;
  systemPromptBase: string;
  isPublished: boolean;
};

const DEFAULT_FORM: FormState = {
  agentName: "Assistente",
  tone: "FRIENDLY",
  greetingMessage: "Olá! Como posso ajudar?",
  inactivityMessage: "Ainda está por aqui?",
  closingMessage: "Até logo!",
  outOfHoursMessage: "No momento estamos fechados. Retornaremos em breve!",
  handoffMessage: "Estou transferindo você para um de nossos atendentes.",
  autoHandoffThreshold: 0.3,
  handoffOrderValueBrl: "",
  inactivityTimeoutMin: 30,
  sessionTtlHours: 24,
  maxConversationLength: 50,
  businessHours: DEFAULT_BUSINESS_HOURS,
  llmModel: "gpt-4o-mini",
  llmTemperature: 0.3,
  maxResponseLength: 500,
  systemPromptBase: "",
  isPublished: false,
};


export default function PersonaPage() {
  const { apiFetch } = useApi();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await apiFetch("/agent/config");
        if (res.ok) {
          const data = await res.json();
          setForm((current) => ({
            ...current,
            ...data,
            llmModel: FIXED_LLM_MODEL.value,
            handoffOrderValueBrl: data.handoffOrderValueBrl != null
              ? centsToMaskedPrice(Math.round(Number(data.handoffOrderValueBrl) * 100))
              : "",
            businessHours: normalizeBusinessHours(data.businessHours),
          }));
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        agentName: form.agentName,
        tone: form.tone,
        greetingMessage: form.greetingMessage,
        inactivityMessage: form.inactivityMessage,
        closingMessage: form.closingMessage,
        outOfHoursMessage: form.outOfHoursMessage,
        handoffMessage: form.handoffMessage,
        autoHandoffThreshold: form.autoHandoffThreshold,
        handoffOrderValueBrl: (() => {
          const cents = maskedPriceToCents(form.handoffOrderValueBrl);
          return cents === null ? null : cents / 100;
        })(),
        inactivityTimeoutMin: form.inactivityTimeoutMin,
        sessionTtlHours: form.sessionTtlHours,
        maxConversationLength: form.maxConversationLength,
        businessHours: form.businessHours,
        llmModel: FIXED_LLM_MODEL.value,
        llmTemperature: form.llmTemperature,
        maxResponseLength: form.maxResponseLength,
        systemPromptBase: form.systemPromptBase,
        isPublished: form.isPublished,
      };
      const res = await apiFetch("/agent/config", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      setDirty(false);
      setToast({ type: "success", msg: "Persona salva com sucesso" });
    } catch {
      setToast({ type: "error", msg: "Erro ao salvar persona" });
    } finally {
      setSaving(false);
    }
  }

  const toneMeta = TONES.find((t) => t.value === form.tone) ?? TONES[2];

  const previewTime = useMemo(
    () =>
      new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  );

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {toast && (
        <div className={`persona-toast persona-toast--${toast.type}`}>
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {toast.msg}
        </div>
      )}

      <div className="fade-up flex flex-col flex-1 min-h-0 overflow-y-auto">
        <Header
          title="Persona do Agente"
          subtitle="Identidade, tom de voz e comportamento da IA"
        />

        <div className="dashboard-page persona-page">
        {/* Hero */}
        <div className={`persona-hero ${form.isPublished ? "persona-hero--live" : ""}`}>
          <div className="persona-hero-glow persona-hero-glow--indigo" aria-hidden="true" />
          <div className="persona-hero-glow persona-hero-glow--violet" aria-hidden="true" />

          <div className="persona-hero-content">
            <div className="flex-1 min-w-0">
              <div className="persona-hero-badge">
                <Sparkles className="w-3 h-3" strokeWidth={2} />
                Identidade do agente
              </div>
              <h2 className="persona-hero-title">
                {loading ? "Carregando…" : form.agentName || "Assistente"}
              </h2>
              <p className="persona-hero-sub">
                Tom <span className="persona-hero-accent">{toneMeta.label.toLowerCase()}</span>
                {" · "}
                {FIXED_LLM_MODEL.label}
                {" · "}
                temp. {form.llmTemperature.toFixed(1)}
              </p>
            </div>

            <span
              className={`persona-status-pill ${form.isPublished ? "persona-status-pill--live" : ""}`}
            >
              {form.isPublished ? (
                <>
                  <span className="persona-status-dot" />
                  Publicado
                </>
              ) : (
                "Rascunho"
              )}
            </span>
          </div>
        </div>

        {/* Info banner */}
        <div className="persona-info-banner">
          <div className="persona-info-icon">
            <MessageCircle className="w-4 h-4 text-indigo-400" strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="persona-info-title">Como a persona funciona</p>
            <p className="persona-info-desc">
              A persona define como seu agente se apresenta e responde no WhatsApp.
              Ajuste o tom e as mensagens — o preview à direita atualiza em tempo real.
            </p>
          </div>
          <Link href="/agent" className="persona-info-link">
            <ChevronLeft className="persona-info-link-chevron" strokeWidth={1.5} />
            Voltar ao agente
          </Link>
        </div>

        <div className="persona-layout">
          {/* Form column */}
          <div className="persona-form-col">
            {/* Identidade */}
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

            {/* Mensagens */}
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
                {(
                  [
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
                  ] as const
                ).map(({ key, label, hint, rows }) => (
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

            {/* Atendimento & Handoff */}
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

            {/* Horário de Funcionamento */}
            <section className="persona-card">
              <div className="persona-card-head">
                <div className="persona-card-icon persona-card-icon--cyan">
                  <Clock className="w-4 h-4" strokeWidth={1.8} />
                </div>
                <div>
                  <p className="persona-card-title">Horário de Funcionamento</p>
                  <p className="persona-card-sub">Define quando o agente responde automaticamente</p>
                </div>
              </div>

              <div className="persona-card-body persona-card-body--stack">
                <div className="persona-hours-list">
                {DAYS.map(({ key, label }) => {
                  const day = form.businessHours[key] ?? { enabled: false, start: "09:00", end: "18:00" };
                  return (
                    <div
                      key={key}
                      className={`persona-hours-row${day.enabled ? " persona-hours-row--on" : ""}`}
                    >
                      <div className="persona-hours-day-col">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={day.enabled}
                          aria-label={`${day.enabled ? "Desativar" : "Ativar"} ${label}`}
                          disabled={loading}
                          className={`persona-hours-switch${day.enabled ? " persona-hours-switch--on" : ""}`}
                          onClick={() =>
                            patch("businessHours", {
                              ...form.businessHours,
                              [key]: { ...day, enabled: !day.enabled },
                            })
                          }
                        >
                          <span className="persona-hours-switch-thumb" />
                        </button>
                        <span className={`persona-hours-day${day.enabled ? "" : " persona-hours-day--off"}`}>
                          {label}
                        </span>
                      </div>
                      <div className="persona-hours-times">
                        <TimeInput
                          value={day.start}
                          onChange={(start) =>
                            patch("businessHours", {
                              ...form.businessHours,
                              [key]: { ...day, start },
                            })
                          }
                          disabled={loading || !day.enabled}
                        />
                        <span className="persona-hours-sep" aria-hidden>
                          até
                        </span>
                        <TimeInput
                          value={day.end}
                          onChange={(end) =>
                            patch("businessHours", {
                              ...form.businessHours,
                              [key]: { ...day, end },
                            })
                          }
                          disabled={loading || !day.enabled}
                        />
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            </section>

            {/* Modelo IA */}
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
          </div>

          {/* Preview column */}
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
        </div>
      </div>
      </div>

      <div className="persona-save-bar">
        <p className={`persona-save-hint${dirty ? " persona-save-hint--dirty" : ""}`}>
          {dirty ? "Alterações não salvas" : "Nenhuma alteração pendente"}
        </p>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || loading || !dirty}
          className="catalog-add-btn"
          style={{ minWidth: 120 }}
        >
          {saving ? "Salvando…" : "Salvar persona"}
        </button>
      </div>
    </div>
  );
}
