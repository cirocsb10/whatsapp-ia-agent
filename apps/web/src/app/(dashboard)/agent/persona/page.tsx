"use client";

import { Header } from "@/components/layout/Header";
import { useApi } from "@/lib/hooks/useApi";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  MessageCircle,
  Sparkles,
  Cpu,
  Thermometer,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Save,
  Zap,
  Globe,
} from "lucide-react";

const TONES = [
  { value: "FORMAL", label: "Formal", desc: "Profissional e objetivo" },
  { value: "INFORMAL", label: "Informal", desc: "Descontraído e leve" },
  { value: "FRIENDLY", label: "Amigável", desc: "Acolhedor e empático" },
  { value: "TECHNICAL", label: "Técnico", desc: "Preciso e detalhado" },
  { value: "REGIONAL", label: "Regional", desc: "Linguagem local" },
] as const;

const MODELS = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini", desc: "Rápido e econômico" },
  { value: "gpt-4o", label: "GPT-4o", desc: "Equilíbrio ideal" },
  { value: "gpt-4-turbo", label: "GPT-4 Turbo", desc: "Máxima capacidade" },
];

type FormState = {
  agentName: string;
  tone: string;
  greetingMessage: string;
  inactivityMessage: string;
  closingMessage: string;
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
  llmModel: "gpt-4o-mini",
  llmTemperature: 0.3,
  maxResponseLength: 500,
  systemPromptBase: "",
  isPublished: false,
};

function tempLabel(value: number) {
  if (value <= 0.3) return "Preciso";
  if (value <= 0.7) return "Equilibrado";
  return "Criativo";
}

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
          setForm((current) => ({ ...current, ...data }));
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
      const res = await apiFetch("/agent/config", {
        method: "PATCH",
        body: JSON.stringify(form),
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
  const modelMeta = MODELS.find((m) => m.value === form.llmModel) ?? MODELS[0];

  const previewTime = useMemo(
    () =>
      new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  );

  return (
    <div className="fade-up flex flex-col h-screen overflow-y-auto">
      <Header
        title="Persona do Agente"
        subtitle="Identidade, tom de voz e comportamento da IA"
      />

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
                {modelMeta.label}
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
              Ajuste o tom, mensagens e modelo — o preview à direita atualiza em tempo real.
            </p>
          </div>
          <Link href="/agent" className="persona-info-link">
            <ArrowLeft className="w-3.5 h-3.5" />
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
                      rows: 2,
                    },
                    {
                      key: "inactivityMessage" as const,
                      label: "Inatividade",
                      hint: "Quando o cliente para de responder",
                      rows: 2,
                    },
                    {
                      key: "closingMessage" as const,
                      label: "Encerramento",
                      hint: "Ao finalizar o atendimento",
                      rows: 2,
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

            {/* Modelo IA */}
            <section className="persona-card">
              <div className="persona-card-head">
                <div className="persona-card-icon persona-card-icon--green">
                  <Cpu className="w-4 h-4" strokeWidth={1.8} />
                </div>
                <div>
                  <p className="persona-card-title">Modelo de IA</p>
                  <p className="persona-card-sub">LLM, criatividade e limites</p>
                </div>
              </div>

              <div className="persona-card-body">
                <label className="form-field">
                  <span className="form-label">Modelo LLM</span>
                  <select
                    value={form.llmModel}
                    onChange={(e) => patch("llmModel", e.target.value)}
                    className="form-input form-select"
                    disabled={loading}
                  >
                    {MODELS.map(({ value, label, desc }) => (
                      <option key={value} value={value}>
                        {label} — {desc}
                      </option>
                    ))}
                  </select>
                </label>

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
                  <input
                    type="number"
                    min={100}
                    max={4000}
                    step={50}
                    value={form.maxResponseLength}
                    onChange={(e) => patch("maxResponseLength", Number(e.target.value))}
                    className="form-input"
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
                    rows={5}
                    placeholder="Ex: Você é um assistente de vendas da loja X. Seja sempre cordial…"
                    className="form-input form-input-mono"
                    disabled={loading}
                  />
                </label>
              </div>
            </section>

            {/* Publicação */}
            <section className="persona-card persona-card--publish">
              <div className="persona-publish-row">
                <div className="persona-publish-info">
                  <div className="persona-card-icon persona-card-icon--green">
                    <Globe className="w-4 h-4" strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="persona-card-title">Publicar agente</p>
                    <p className="persona-card-sub">
                      Ativa respostas automáticas no WhatsApp
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.isPublished}
                  onClick={() => patch("isPublished", !form.isPublished)}
                  className={`persona-toggle ${form.isPublished ? "persona-toggle--on" : ""}`}
                  disabled={loading}
                  aria-label={form.isPublished ? "Despublicar agente" : "Publicar agente"}
                >
                  <span className="persona-toggle-thumb" />
                </button>
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
                  {modelMeta.label}
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

      {/* Sticky save bar */}
      <div className="persona-save-bar">
        <p className="persona-save-hint">
          {dirty ? "Alterações não salvas" : "Nenhuma alteração pendente"}
        </p>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || loading || !dirty}
          className="persona-save-btn"
        >
          <Save className="w-4 h-4" strokeWidth={2} />
          {saving ? "Salvando…" : "Salvar persona"}
        </button>
      </div>
    </div>
  );
}
