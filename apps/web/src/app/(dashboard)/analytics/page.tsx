"use client";

import { Header } from "@/components/layout/Header";
import { KpiCard } from "@/components/analytics/KpiCard";
import { ConversionFunnel } from "@/components/analytics/FunnelChart";
import { ActivityHeatmap } from "@/components/analytics/HeatmapChart";
import { HandoffReasons } from "@/components/analytics/HandoffReasons";
import { useApi } from "@/lib/hooks/useApi";
import { useEffect, useState } from "react";
import {
  Target, Users, ShoppingCart, DollarSign, Clock, Zap,
  CalendarDays, Star, Cpu,
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
  const { apiFetch } = useApi();
  const [period, setPeriod] = useState(30);
  const [kpis, setKpis] = useState<Record<string, number | null>>({});
  const [funnel, setFunnel] = useState(EMPTY_FUNNEL);
  const [heatmap, setHeatmap] = useState(EMPTY_HEATMAP);
  const [handoffs, setHandoffs] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [kpiRes, funnelRes, heatmapRes, handoffRes] = await Promise.all([
          apiFetch("/analytics/kpis"),
          apiFetch(`/analytics/funnel?days=${period}`),
          apiFetch(`/analytics/heatmap?days=${period}`),
          apiFetch(`/analytics/handoff-reasons?days=${period}`),
        ]);
        if (kpiRes.ok) setKpis(await kpiRes.json());
        if (funnelRes.ok) setFunnel(await funnelRes.json());
        if (heatmapRes.ok) setHeatmap(await heatmapRes.json());
        if (handoffRes.ok) setHandoffs(await handoffRes.json());
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <div className="analytics-intro">
          <div>
            <p className="dashboard-greeting-title">Relatorio de Performance</p>
            <p className="dashboard-greeting-sub">
              Acompanhe conversoes, funil de vendas e atividade do agente IA.
            </p>
          </div>
          <div className="analytics-period-pills">
            <CalendarDays className="w-3.5 h-3.5 text-[#475569]" />
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

        <section>
          <div className="dashboard-section-head">
            <p className="section-title">Metricas do periodo</p>
            <span className="text-[10px] text-[#475569]">Ultimos {period} dias</span>
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

        <div className="analytics-bento-top">
          <ConversionFunnel data={funnel} />
          <HandoffReasons data={handoffs} />
        </div>

        <ActivityHeatmap data={heatmap} />
      </div>
    </div>
  );
}
