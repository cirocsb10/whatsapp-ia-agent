"use client";

import { Header } from "@/components/layout/Header";
import { KpiCard } from "@/components/analytics/KpiCard";
import { ConversionFunnel } from "@/components/analytics/FunnelChart";
import { ActivityHeatmap } from "@/components/analytics/HeatmapChart";
import { HandoffReasons } from "@/components/analytics/HandoffReasons";
import { MessagingCostPanel } from "@/components/analytics/MessagingCostPanel";
import {
  useKpis,
  useFunnel,
  useHeatmap,
  useHandoffReasons,
  useMessagingCost,
  type Kpis,
  type FunnelData,
  type HandoffReasonsData,
  type HeatmapBucket,
} from "@/features/analytics/api/queries";
import { useState } from "react";
import {
  Target, Users, ShoppingCart, DollarSign, Clock, Zap,
  CalendarDays, Star, Cpu, BarChart2,
} from "lucide-react";

const KPI_CARDS = [
  { key: "conversations_today", title: "Conversas", icon: Users, iconColor: "text-indigo-400", accent: "#6366f1" },
  { key: "catalog_viewed", title: "Viram Catalogo", icon: Target, iconColor: "text-violet-400", accent: "#8b5cf6" },
  { key: "cart_started", title: "Adicionaram", icon: ShoppingCart, iconColor: "text-pink-400", accent: "#ec4899" },
  { key: "conversion_rate", title: "Converteram", icon: Zap, iconColor: "text-green-400", accent: "#22c55e", suffix: "%" },
  { key: "revenue_today", title: "Receita", icon: DollarSign, iconColor: "text-yellow-400", accent: "#f59e0b", money: true },
  { key: "avg_response_time_sec", title: "Tempo Medio", icon: Clock, iconColor: "text-cyan-400", accent: "#06b6d4", suffix: "s" },
  { key: "avg_csat_score", title: "CSAT (7 dias)", icon: Star, iconColor: "text-yellow-400", accent: "#fbbf24", csat: true },
  { key: "ai_tokens_today", title: "Tokens hoje", icon: Cpu, iconColor: "text-indigo-400", accent: "#6366f1", tokens: true },
];

const EMPTY_FUNNEL = {
  conversations: 0,
  catalog_viewed: 0,
  cart_started: 0,
  payment_generated: 0,
  payment_confirmed: 0,
};

const EMPTY_HEATMAP = Array.from({ length: 7 * 24 }, (_, i) => ({
  day: Math.floor(i / 24),
  hour: i % 24,
  value: 0,
}));

const PERIODS = [
  { label: "Hoje", days: 1 },
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState(30);

  // Mesmos hooks do overview: `useKpis` compartilha cache (dedupe), demais keyed por período.
  const kpisQuery = useKpis();
  const funnelQuery = useFunnel(period);
  const heatmapQuery = useHeatmap(period);
  const handoffQuery = useHandoffReasons(period);
  const messagingCostQuery = useMessagingCost(period);

  const kpis: Kpis = kpisQuery.data ?? {};
  const funnel: FunnelData = funnelQuery.data ?? EMPTY_FUNNEL;
  const heatmap: HeatmapBucket[] = heatmapQuery.data ?? EMPTY_HEATMAP;
  const handoffs: HandoffReasonsData = handoffQuery.data ?? {};
  const loading =
    kpisQuery.isPending || funnelQuery.isPending || heatmapQuery.isPending || handoffQuery.isPending;

  function formatCard(card: (typeof KPI_CARDS)[number]) {
    if ("csat" in card && card.csat) {
      const raw = kpis[card.key];
      return raw != null ? `${raw}/5` : "—";
    }
    if ("tokens" in card && card.tokens) {
      const raw = kpis[card.key];
      if (raw == null) return "—";
      return raw > 1000 ? `${(raw / 1000).toFixed(1)}k` : String(raw);
    }
    const value = card.key in funnel ? funnel[card.key as keyof typeof funnel] : (kpis[card.key] ?? 0);
    if ("money" in card && card.money) {
      return ((kpis[card.key] ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
    return `${value.toLocaleString("pt-BR")}${"suffix" in card ? card.suffix ?? "" : ""}`;
  }

  function isCardEmpty(card: (typeof KPI_CARDS)[number]) {
    if ("csat" in card && card.csat) return kpis[card.key] == null;
    if ("tokens" in card && card.tokens) return (kpis[card.key] ?? 0) === 0;
    const value = formatCard(card);
    return value.replace(/\D/g, "") === "0" || value === "—";
  }

  return (
    <div className="fade-up flex flex-col h-screen">
      <Header title="Analytics" subtitle="Metricas e performance do agente" />

      <div className="dashboard-page">
        <div className="analytics-hero">
          <div className="analytics-hero-content">
            <div className="analytics-hero-badge">
              <BarChart2 className="w-3 h-3" strokeWidth={2} />
              Performance
            </div>
            <h2 className="analytics-hero-title">Relatório de Performance</h2>
            <p className="analytics-hero-sub">
              Acompanhe conversões, funil de vendas e atividade do agente IA.
            </p>
          </div>
          <div className="analytics-hero-actions">
            <div className="analytics-period-pills">
              <CalendarDays className="w-3.5 h-3.5 text-[#475569] ml-1" />
              {PERIODS.map((p) => (
                <button
                  key={p.days}
                  onClick={() => setPeriod(p.days)}
                  className={`analytics-period-pill ${period === p.days ? "analytics-period-pill-active" : ""}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <section>
          <div className="analytics-section-head">
            <div className="analytics-section-accent" />
            <p className="analytics-section-label">Métricas do Período</p>
            <span className="text-[10px] text-[#334155] tabular-nums">Últimos {period} {period === 1 ? "dia" : "dias"}</span>
          </div>
          <div className="analytics-kpi-grid">
            {KPI_CARDS.map((card) => {
              const { key: metricKey, ...cardProps } = card;
              const value = formatCard(card);
              return (
                <KpiCard
                  key={card.title}
                  {...cardProps}
                  value={value}
                  loading={loading}
                  empty={!loading && isCardEmpty(card)}
                />
              );
            })}
          </div>
        </section>

        <section>
          <div className="analytics-section-head">
            <div className="analytics-section-accent" style={{ background: "linear-gradient(180deg,#ec4899,#8b5cf6)" }} />
            <p className="analytics-section-label">Jornada & Handoffs</p>
          </div>
          <div className="analytics-bento-top">
            <ConversionFunnel data={funnel} />
            <HandoffReasons data={handoffs} />
          </div>
        </section>

        <section>
          <div className="analytics-section-head">
            <div className="analytics-section-accent" style={{ background: "linear-gradient(180deg,#22c55e,#06b6d4)" }} />
            <p className="analytics-section-label">Uso e custos</p>
            <span className="text-[10px] text-[#334155]">Estimativa · não é fatura Meta</span>
          </div>
          <MessagingCostPanel
            data={messagingCostQuery.data}
            loading={messagingCostQuery.isPending}
          />
        </section>

        <section>
          <div className="analytics-section-head">
            <div className="analytics-section-accent" style={{ background: "linear-gradient(180deg,#06b6d4,#6366f1)" }} />
            <p className="analytics-section-label">Atividade por Horário</p>
          </div>
          <ActivityHeatmap data={heatmap} />
        </section>
      </div>
    </div>
  );
}
