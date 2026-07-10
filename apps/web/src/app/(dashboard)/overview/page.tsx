"use client";

import { Header } from "@/components/layout/Header";
import { KpiCard } from "@/components/analytics/KpiCard";
import { FunnelChart } from "@/components/analytics/FunnelChart";
import { HandoffReasons } from "@/components/analytics/HandoffReasons";
import { DashboardSetupBanner } from "@/components/analytics/DashboardSetupBanner";
import { Skeleton } from "@/shared/ui/Skeleton";
import {
  useDashboard,
  type Kpis,
  type KpiTrends,
  type ChartPoint,
  type SetupStatusData,
  type FunnelData,
  type HandoffReasonsData,
} from "@/features/analytics/api/queries";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";

// recharts é pesado e eager: carrega sob demanda (client-only) com skeleton (plano §3.9).
const ConversationsChart = dynamic(
  () => import("@/components/analytics/ConversationsChart").then((m) => m.ConversationsChart),
  {
    ssr: false,
    loading: () => (
      <div className="chart-panel">
        <Skeleton className="h-[320px] w-full" />
      </div>
    ),
  },
);
import {
  MessageSquare, Zap, DollarSign, PhoneCall,
  Users, ShoppingCart, TrendingUp, Clock,
  CheckCircle2, Star, Bot, Cpu,
  Settings, BarChart3, RefreshCw,
} from "lucide-react";

const CARDS = [
  { key: "conversations_today", title: "Conversas Hoje", icon: MessageSquare, iconColor: "text-indigo-400", accent: "#6366f1" },
  { key: "ai_resolution_rate", title: "Resolução por IA", icon: Zap, iconColor: "text-green-400", accent: "#22c55e", suffix: "%" },
  { key: "revenue_today", title: "Receita do Dia", icon: DollarSign, iconColor: "text-yellow-400", accent: "#fbbf24", money: true },
  { key: "pending_handoffs", title: "Handoffs Pendentes", icon: PhoneCall, iconColor: "text-red-400", accent: "#ef4444" },
  { key: "avg_response_time_sec", title: "Tempo Médio Resp.", icon: Clock, iconColor: "text-cyan-400", accent: "#06b6d4", suffix: "s" },
  { key: "new_contacts_today", title: "Novos Contatos", icon: Users, iconColor: "text-violet-400", accent: "#8b5cf6" },
  { key: "orders_today", title: "Pedidos Hoje", icon: ShoppingCart, iconColor: "text-orange-400", accent: "#f97316" },
  { key: "conversion_rate", title: "Taxa Conversão", icon: TrendingUp, iconColor: "text-emerald-400", accent: "#10b981", suffix: "%" },
  { key: "avg_csat_score", title: "CSAT (7 dias)", icon: Star, iconColor: "text-yellow-400", accent: "#fbbf24", csat: true },
  { key: "ai_tokens_today", title: "Tokens hoje", icon: Cpu, iconColor: "text-indigo-400", accent: "#6366f1", tokens: true },
];

const AGENT_STATUS = [
  { label: "Resolução IA", icon: CheckCircle2, color: "#6366f1", key: "ai_resolution_rate" },
  { label: "Satisfação CSAT", icon: Star, color: "#22c55e", key: "avg_csat_score", csat: true },
];

const QUICK_ACTIONS = [
  { href: "/agent", label: "Agente IA", icon: Bot, color: "#6366f1" },
  { href: "/inbox", label: "Conversas", icon: MessageSquare, color: "#06b6d4" },
  { href: "/settings", label: "Configurações", icon: Settings, color: "#94a3b8" },
];

const POLL_MS = 30_000;

export default function OverviewPage() {
  const [chartDays, setChartDays] = useState(30);

  // 1 request agregado (F2 §3.4) com cache + revalidação por foco/visibilidade
  // (o TanStack Query pausa o intervalo com a aba oculta).
  const dashboardQuery = useDashboard(chartDays, POLL_MS);
  const data = dashboardQuery.data;

  const kpis: Kpis = data?.kpis ?? {};
  const trends: KpiTrends = data?.trends ?? {};
  const chart: ChartPoint[] = data?.chart ?? [];
  const setupStatus: SetupStatusData | null = data?.setupStatus ?? null;
  const funnel: FunnelData | null = data?.funnel ?? null;
  const handoffReasons: HandoffReasonsData | null = data?.handoffReasons ?? null;
  const loading = dashboardQuery.isPending;
  const lastUpdated = dashboardQuery.dataUpdatedAt ? new Date(dashboardQuery.dataUpdatedAt) : null;

  const date = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });
  const isActive = (kpis.conversations_today ?? 0) > 0;

  const isDashboardEmpty = useMemo(() => {
    if (loading) return false;
    const noConversations = (kpis.conversations_today ?? 0) === 0;
    const noChart = chart.length === 0;
    const noFunnel = !funnel || funnel.conversations === 0;
    return noConversations && noChart && noFunnel;
  }, [loading, kpis, chart, funnel]);

  function formatCard(card: (typeof CARDS)[number]) {
    const raw = kpis[card.key];
    if ("csat" in card && card.csat) {
      return raw != null ? `${raw}/5` : "—";
    }
    if ("tokens" in card && card.tokens) {
      if (raw == null) return "—";
      return raw > 1000 ? `${(raw / 1000).toFixed(1)}k` : String(raw);
    }
    const value = raw ?? 0;
    if ("money" in card && card.money) {
      return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
    return `${value.toLocaleString("pt-BR")}${"suffix" in card ? card.suffix ?? "" : ""}`;
  }

  function isCardEmpty(card: (typeof CARDS)[number]) {
    const raw = kpis[card.key];
    if ("csat" in card && card.csat) return raw == null;
    if ("tokens" in card && card.tokens) return raw == null || raw === 0;
    return (raw ?? 0) === 0;
  }

  const showSetupBanner = setupStatus && (
    !setupStatus.setupComplete || isDashboardEmpty
  );

  return (
    <div className="fade-up overview-page">
      <div className="overview-ambient" aria-hidden="true">
        <div className="overview-orb overview-orb-green" />
        <div className="overview-orb overview-orb-indigo" />
      </div>

      <Header title="Overview" />

      <div className="dashboard-page">
        {/* Hero */}
        <header className="dashboard-hero">
          <div className="dashboard-hero-content">
            <p className="dashboard-hero-eyebrow">
              <BarChart3 className="w-3.5 h-3.5" strokeWidth={2} />
              Painel operacional
            </p>
            <h1 className="dashboard-hero-title">
              {isActive ? (
                <>Seu agente está <span className="dashboard-hero-accent">ativo</span></>
              ) : (
                <>Pronto para <span className="dashboard-hero-accent">escalar</span> atendimento</>
              )}
            </h1>
            <p className="dashboard-hero-sub">
              {date.charAt(0).toUpperCase() + date.slice(1)} — conversas, vendas e performance do agente IA.
            </p>

            <div className="dashboard-quick-actions">
              {QUICK_ACTIONS.map(({ href, label, icon: Icon, color }) => (
                <Link key={label} href={href} className="dashboard-quick-action">
                  <span className="dashboard-quick-action-icon" style={{ ["--qa-color" as string]: color }}>
                    <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
                  </span>
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className="dashboard-hero-aside">
            <div className={`dashboard-status-pill ${isActive ? "is-active" : ""}`}>
              <span className="dashboard-status-dot" />
              {isActive ? "Agente ativo" : "Agente inativo"}
            </div>
            {lastUpdated && (
              <span className="dashboard-live-badge">
                <RefreshCw className="w-3 h-3" strokeWidth={2} />
                {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </header>

        {showSetupBanner && (
          <DashboardSetupBanner setup={setupStatus} isEmpty={isDashboardEmpty} />
        )}

        <section>
          <div className="dashboard-section-head">
            <p className="section-title">Métricas de hoje</p>
            <span className="dashboard-section-meta">
              {loading ? "Atualizando…" : "Atualização automática a cada 30s"}
            </span>
          </div>
          <div className="dashboard-kpi-grid">
            {CARDS.map((card, i) => {
              const { key: metricKey, ...cardProps } = card;
              const trend = trends[card.key];
              return (
                <div key={card.title} className="overview-kpi-wrap" style={{ animationDelay: `${i * 40}ms` }}>
                  <KpiCard
                    {...cardProps}
                    value={formatCard(card)}
                    loading={loading}
                    empty={!loading && isCardEmpty(card)}
                    {...(trend ? { change: trend.change, trend: trend.trend } : {})}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <div className="dashboard-bento">
          <ConversationsChart
            data={chart}
            days={chartDays}
            onDaysChange={setChartDays}
            {...(setupStatus ? { whatsappConnected: setupStatus.whatsappConnected } : {})}
          />

          <aside className="dashboard-agent-panel">
            <div className="dashboard-agent-header">
              <div className="dashboard-agent-icon">
                <Bot className="w-4 h-4" strokeWidth={1.8} />
              </div>
              <div className="dashboard-agent-header-text">
                <p className="dashboard-agent-title">Status do Agente</p>
                <p className="dashboard-agent-subtitle">Monitoramento em tempo real</p>
              </div>
              <span className={`tag ${isActive ? "tag-green" : "tag-slate"} shrink-0 mt-0.5`}>
                {isActive ? "Ativo" : "Inativo"}
              </span>
            </div>

            <div className="dashboard-agent-metrics">
              {AGENT_STATUS.map(({ label, icon: Icon, color, key, csat }) => {
                const raw = key ? kpis[key] : null;
                const display = key
                  ? csat
                    ? (raw != null ? `${raw}/5` : "—")
                    : `${raw ?? 0}%`
                  : "—";
                const barWidth = key && !csat ? (raw ?? 0) : key && csat && raw != null ? (raw / 5) * 100 : 0;
                return (
                  <div key={label} className="dashboard-agent-metric">
                    <div className="dashboard-agent-metric-row">
                      <div className="dashboard-agent-metric-label">
                        <div className="dashboard-agent-metric-icon">
                          <Icon className="w-3 h-3" style={{ color }} strokeWidth={1.8} />
                        </div>
                        <span className="dashboard-agent-metric-name">{label}</span>
                      </div>
                      <span className="dashboard-agent-metric-value">{display}</span>
                    </div>
                    <div className="prog-track">
                      <div
                        className="prog-fill"
                        style={{ width: `${barWidth}%`, background: color, opacity: 0.55 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <Link href="/agent" className="dashboard-agent-link">
              Configurar agente
            </Link>
          </aside>
        </div>

        <section>
          <div className="dashboard-section-head overview-insight-head">
            <div className="overview-insight-head-left">
              <span className="overview-insight-accent" />
              <p className="section-title">Jornada &amp; Handoffs</p>
            </div>
            <span className="dashboard-section-meta">Últimos 30 dias</span>
          </div>
          <div className="dashboard-secondary-grid">
            <FunnelChart data={funnel} />
            <HandoffReasons data={handoffReasons} />
          </div>
        </section>
      </div>
    </div>
  );
}
