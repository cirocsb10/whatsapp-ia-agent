"use client";

import { Header } from "@/components/layout/Header";
import { TestSimulator } from "@/components/agent/TestSimulator";
import { PublishAgentModal } from "@/components/agent/PublishAgentModal";
import {
  useAgentConfig,
  useKnowledge,
  useGuardRules,
  useUpdateAgentConfig,
} from "@/features/agent/api/queries";
import { useMemo, useState } from "react";
import {
  Bot, Shield, Database, ChevronRight,
  Sparkles, BookOpen, Cpu, Sliders, Kanban,
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
  },
];

const SETUP_STEPS = [
  { key: "persona", label: "Persona definida" },
  { key: "knowledge", label: "Base de conhecimento" },
  { key: "rules", label: "Guard rails" },
] as const;

export default function AgentPage() {
  const configQuery = useAgentConfig();
  const knowledgeQuery = useKnowledge();
  const rulesQuery = useGuardRules();
  const updateConfig = useUpdateAgentConfig();

  const config = configQuery.data ?? null;
  const knowledgeCount = knowledgeQuery.data?.length ?? 0;
  const rulesCount = rulesQuery.data?.length ?? 0;
  const loading = configQuery.isPending || knowledgeQuery.isPending || rulesQuery.isPending;
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const publishing = updateConfig.isPending;

  async function handlePublish() {
    setPublishError(null);
    try {
      await updateConfig.mutateAsync({ isPublished: true });
      setShowPublishModal(false);
    } catch {
      setPublishError("Não foi possível publicar o agente. Tente novamente.");
    }
  }

  async function handleCrmProgressionToggle(enabled: boolean) {
    try {
      await updateConfig.mutateAsync({ crmProgressionEnabled: enabled });
    } catch {
      setPublishError("Não foi possível atualizar a progressão do funil CRM.");
    }
  }

  const published = Boolean(config?.isPublished);
  const crmProgressionEnabled = config?.crmProgressionEnabled !== false;
  const hasPersona = Boolean(config?.agentName && config?.agentName !== "Assistente");

  const setupDone = useMemo(() => ({
    persona: hasPersona || published,
    knowledge: knowledgeCount > 0,
    rules: rulesCount > 0,
  }), [hasPersona, published, knowledgeCount, rulesCount]);

  const readiness = Math.round(
    (Object.values(setupDone).filter(Boolean).length / SETUP_STEPS.length) * 100
  );

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

            <label className="agent-crm-toggle">
              <input
                type="checkbox"
                checked={crmProgressionEnabled}
                onChange={(e) => void handleCrmProgressionToggle(e.target.checked)}
                disabled={loading || publishing}
                className="sr-only"
              />
              <span className={`persona-toggle ${crmProgressionEnabled ? "persona-toggle--on" : ""}`}>
                <span className="persona-toggle-thumb" />
              </span>
              <span className="agent-crm-toggle-text">
                <span className="agent-crm-toggle-label">
                  <Kanban className="w-3.5 h-3.5" strokeWidth={1.8} />
                  Progressão automática do funil CRM
                </span>
                <span className="agent-crm-toggle-desc">
                  {crmProgressionEnabled
                    ? "Deals avançam automaticamente por conversas, pedidos e pagamentos"
                    : "Funil permanece manual — eventos não movem stages"}
                </span>
              </span>
            </label>

            {!published && (
              <button
                type="button"
                onClick={() => setShowPublishModal(true)}
                className="catalog-add-btn agent-publish-btn"
              >
                Publicar agente
              </button>
            )}
          </div>
        </div>

        {/* Config grid */}
        <section className="agent-section">
          <div className="agent-section-head">
            <div>
              <p className="agent-section-title">Configuração</p>
              <p className="agent-section-sub">3 módulos essenciais para personalizar seu agente</p>
            </div>
          </div>

          <div className="agent-config-grid">
            {CONFIG_SECTIONS.map(({ href, label, desc, icon: Icon, color, bg, border, tag, step }) => (
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
                </div>

                <div className="agent-config-cta" style={{ borderColor: `${color}20` }}>
                  <span style={{ color }}>Configurar</span>
                  <ChevronRight className="agent-config-chevron" style={{ color }} strokeWidth={1.5} />
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

      <PublishAgentModal
        open={showPublishModal}
        publishing={publishing}
        readiness={readiness}
        checklist={[
          { key: "persona", label: "Persona", done: setupDone.persona },
          { key: "knowledge", label: "Base de conhecimento", done: setupDone.knowledge },
          { key: "rules", label: "Guard rails", done: setupDone.rules },
        ]}
        error={publishError}
        onConfirm={handlePublish}
        onClose={() => { setShowPublishModal(false); setPublishError(null); }}
      />
    </div>
  );
}
