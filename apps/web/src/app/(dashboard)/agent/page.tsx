"use client";

import { Header } from "@/components/layout/Header";
import { TestSimulator } from "@/components/agent/TestSimulator";
import { useApi } from "@/lib/hooks/useApi";
import { useEffect, useMemo, useState } from "react";
import {
  Bot, Shield, Database, Settings, ArrowRight,
  Sparkles, BookOpen, Cpu, Sliders, Zap,
  CheckCircle2, Circle, Rocket,
} from "lucide-react";
import Link from "next/link";

const CONFIG_SECTIONS = [
  {
    href: "/agent/persona",
    label: "Persona",
    desc: "Defina nome, tom de voz, saudação e personalidade do agente.",
    icon: Bot,
    color: "#6366f1",
    bg: "rgba(99,102,241,0.12)",
    border: "rgba(99,102,241,0.25)",
    tag: "Identidade",
    step: 1,
  },
  {
    href: "/agent/knowledge",
    label: "Base de Conhecimento",
    desc: "Adicione FAQs, documentos e contexto para o agente responder.",
    icon: Database,
    color: "#06b6d4",
    bg: "rgba(6,182,212,0.12)",
    border: "rgba(6,182,212,0.25)",
    tag: "Conhecimento",
    step: 2,
    countKey: "knowledge" as const,
  },
  {
    href: "/agent/rules",
    label: "Guard Rails",
    desc: "Configure regras anti-alucinação e limites de comportamento.",
    icon: Shield,
    color: "#22c55e",
    bg: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.25)",
    tag: "Segurança",
    step: 3,
    countKey: "rules" as const,
  },
  {
    href: "/settings",
    label: "Configurações",
    desc: "Integrações, webhooks, modelos de IA e configurações avançadas.",
    icon: Settings,
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.12)",
    border: "rgba(139,92,246,0.25)",
    tag: "Avançado",
    step: 4,
  },
];

const SETUP_STEPS = [
  { key: "persona", label: "Persona definida" },
  { key: "knowledge", label: "Base de conhecimento" },
  { key: "rules", label: "Guard rails" },
] as const;

export default function AgentPage() {
  const { apiFetch } = useApi();
  const [config, setConfig] = useState<any>(null);
  const [knowledgeCount, setKnowledgeCount] = useState(0);
  const [rulesCount, setRulesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [configRes, knowledgeRes, rulesRes] = await Promise.all([
          apiFetch("/agent/config"),
          apiFetch("/agent/knowledge"),
          apiFetch("/agent/rules"),
        ]);
        if (configRes.ok) setConfig(await configRes.json());
        if (knowledgeRes.ok) setKnowledgeCount((await knowledgeRes.json()).length);
        if (rulesRes.ok) setRulesCount((await rulesRes.json()).length);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const published = Boolean(config?.isPublished);
  const hasPersona = Boolean(config?.agentName && config?.agentName !== "Assistente");

  const setupDone = useMemo(() => ({
    persona: hasPersona || published,
    knowledge: knowledgeCount > 0,
    rules: rulesCount > 0,
  }), [hasPersona, published, knowledgeCount, rulesCount]);

  const readiness = Math.round(
    (Object.values(setupDone).filter(Boolean).length / SETUP_STEPS.length) * 100
  );

  const counts: Record<string, number> = { knowledge: knowledgeCount, rules: rulesCount };

  const stats = [
    { label: "Modelo LLM", value: config?.llmModel ?? "—", icon: Cpu, color: "#6366f1", bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.25)" },
    { label: "Documentos", value: loading ? "…" : knowledgeCount, icon: BookOpen, color: "#06b6d4", bg: "rgba(6,182,212,0.12)", border: "rgba(6,182,212,0.25)" },
    { label: "Guard rails", value: loading ? "…" : rulesCount, icon: Sliders, color: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.25)" },
  ];

  return (
    <div className="fade-up flex flex-col h-screen overflow-y-auto">
      <Header title="Agente IA" subtitle="Configure o comportamento do agente" />

      <div className="dashboard-page agent-page">
        {/* Hero */}
        <div className={`agent-hero ${published ? "agent-hero--live" : ""}`}>
          <div className="agent-hero-glow agent-hero-glow--indigo" aria-hidden="true" />
          <div className="agent-hero-glow agent-hero-glow--green" aria-hidden="true" />

          <div className="agent-hero-main">
            <div className="agent-hero-top">
              <div className="agent-hero-badge">
                <Sparkles className="w-3 h-3" strokeWidth={2} />
                AI Agent Studio
              </div>
              {published && (
                <div className="agent-live-pill">
                  <span className="agent-live-dot" />
                  Ao vivo
                </div>
              )}
            </div>

            <div className="agent-hero-body">
              <div className={`agent-avatar-ring ${published ? "agent-avatar-ring--live" : ""}`}>
                <div className="agent-avatar-inner">
                  <Bot className="w-7 h-7 text-indigo-300" strokeWidth={1.5} />
                </div>
                {published && <span className="agent-avatar-pulse" aria-hidden="true" />}
              </div>

              <div className="agent-hero-info">
                <div className="agent-hero-title-row">
                  <h2 className="agent-hero-title">
                    {loading ? "Carregando…" : (config?.agentName ?? "Assistente")}
                  </h2>
                  <span className={`agent-status-tag ${published ? "agent-status-tag--live" : "agent-status-tag--idle"}`}>
                    {published ? "Publicado" : "Inativo"}
                  </span>
                </div>
                <p className="agent-hero-sub">
                  {published
                    ? "Seu agente está ativo e respondendo clientes no WhatsApp."
                    : "Configure a persona, conhecimento e regras — depois publique para ativar."}
                </p>

                {!published && (
                  <div className="agent-readiness">
                    <div className="agent-readiness-head">
                      <span className="agent-readiness-label">Prontidão do agente</span>
                      <span className="agent-readiness-pct">{readiness}%</span>
                    </div>
                    <div className="agent-readiness-track">
                      <div className="agent-readiness-fill" style={{ width: `${readiness}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="agent-hero-side">
            <div className="agent-stats-row">
              {stats.map(({ label, value, icon: Icon, color, bg, border }) => (
                <div
                  key={label}
                  className="agent-stat-card"
                  style={{ "--stat-accent": color, "--stat-border": border, "--stat-glow": `${color}18` } as React.CSSProperties}
                >
                  <div className="agent-stat-glow" aria-hidden="true" />
                  <div className="agent-stat-icon" style={{ background: bg, borderColor: border }}>
                    <Icon className="w-3.5 h-3.5" style={{ color }} strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="agent-stat-value">{value}</p>
                    <p className="agent-stat-label">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {!published && (
              <Link href="/agent/persona" className="agent-publish-cta">
                <Rocket className="w-4 h-4" strokeWidth={1.8} />
                Publicar agente
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>

        {/* Setup checklist */}
        {!published && (
          <div className="agent-setup-banner">
            <div className="agent-setup-banner-icon">
              <Zap className="w-4 h-4 text-amber-400" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="agent-setup-banner-title">Complete a configuração antes de publicar</p>
              <div className="agent-setup-steps">
                {SETUP_STEPS.map(({ key, label }) => {
                  const done = setupDone[key];
                  return (
                    <span key={key} className={`agent-setup-step ${done ? "agent-setup-step--done" : ""}`}>
                      {done
                        ? <CheckCircle2 className="w-3 h-3" strokeWidth={2} />
                        : <Circle className="w-3 h-3" strokeWidth={2} />
                      }
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
            <Link href="/agent/persona" className="agent-setup-banner-cta">
              Continuar setup
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Config grid */}
        <section className="agent-section">
          <div className="agent-section-head">
            <div>
              <p className="agent-section-title">Configuração</p>
              <p className="agent-section-sub">4 módulos para personalizar seu agente</p>
            </div>
          </div>

          <div className="agent-config-grid">
            {CONFIG_SECTIONS.map(({ href, label, desc, icon: Icon, color, bg, border, tag, step, countKey }) => (
              <Link
                key={href}
                href={href}
                className="agent-config-card"
                style={{ "--card-accent": color, "--card-glow": `${color}20` } as React.CSSProperties}
              >
                <div className="agent-config-card-glow" aria-hidden="true" />
                <div className="agent-config-card-accent" aria-hidden="true" />

                <div className="agent-config-card-top">
                  <span className="agent-config-step">{step}</span>
                  <div className="agent-config-icon" style={{ background: bg, borderColor: border }}>
                    <Icon className="w-4 h-4" style={{ color }} strokeWidth={1.8} />
                  </div>
                  <span className="agent-config-tag" style={{ color, background: bg, borderColor: border }}>
                    {tag}
                  </span>
                </div>

                <div className="agent-config-body">
                  <p className="agent-config-label">{label}</p>
                  <p className="agent-config-desc">{desc}</p>
                  {countKey && (
                    <p className="agent-config-count" style={{ color }}>
                      {loading ? "…" : `${counts[countKey]} ${countKey === "knowledge" ? "documento(s)" : "regra(s)"}`}
                    </p>
                  )}
                </div>

                <div className="agent-config-cta" style={{ borderColor: `${color}20` }}>
                  <span style={{ color }}>Configurar</span>
                  <ArrowRight className="w-3.5 h-3.5" style={{ color }} strokeWidth={2} />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Simulator */}
        <section className="agent-section">
          <div className="agent-section-head">
            <div className="agent-section-head-icon">
              <Sparkles className="w-4 h-4 text-indigo-400" strokeWidth={1.8} />
            </div>
            <div>
              <p className="agent-section-title">Simulador de Teste</p>
              <p className="agent-section-sub">Valide respostas antes de publicar no WhatsApp</p>
            </div>
          </div>
          <div className="agent-simulator-wrap">
            <TestSimulator />
          </div>
        </section>
      </div>
    </div>
  );
}
