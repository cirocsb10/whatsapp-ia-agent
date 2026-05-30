import { Header } from "@/components/layout/Header";
import { KpiCard } from "@/components/analytics/KpiCard";
import { ConversionFunnel } from "@/components/analytics/FunnelChart";
import { ActivityHeatmap } from "@/components/analytics/HeatmapChart";
import { HandoffReasons } from "@/components/analytics/HandoffReasons";
import {
  Target, Users, ShoppingCart, DollarSign, Clock, Zap,
  CalendarDays,
} from "lucide-react";

const KPI_CARDS = [
  { title: "Conversas",     icon: Users,        iconColor: "text-indigo-400",  accent: "#6366f1" },
  { title: "Viram Catálogo",icon: Target,        iconColor: "text-violet-400",  accent: "#8b5cf6" },
  { title: "Adicionaram",   icon: ShoppingCart,  iconColor: "text-pink-400",    accent: "#ec4899" },
  { title: "Converteram",   icon: Zap,           iconColor: "text-green-400",   accent: "#22c55e" },
  { title: "Pedidos",       icon: DollarSign,    iconColor: "text-yellow-400",  accent: "#f59e0b" },
  { title: "Tempo Médio",   icon: Clock,         iconColor: "text-cyan-400",    accent: "#06b6d4" },
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

export default function AnalyticsPage() {
  return (
    <div className="fade-up flex flex-col h-screen">
      <Header title="Analytics" subtitle="Métricas e performance do agente" />

      <div className="dashboard-page">
        {/* Page intro */}
        <div className="analytics-intro">
          <div>
            <p className="dashboard-greeting-title">Relatório de Performance</p>
            <p className="dashboard-greeting-sub">
              Acompanhe conversões, funil de vendas e atividade do agente IA.
            </p>
          </div>
          <div className="analytics-period-pills">
            <CalendarDays className="w-3.5 h-3.5 text-[#475569]" />
            {["Hoje", "7 dias", "30 dias"].map((p, i) => (
              <button key={p} className={`analytics-period-pill ${i === 2 ? "analytics-period-pill-active" : ""}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* KPI grid */}
        <section>
          <div className="dashboard-section-head">
            <p className="section-title">Métricas do período</p>
            <span className="text-[10px] text-[#475569]">Últimos 30 dias</span>
          </div>
          <div className="analytics-kpi-grid">
            {KPI_CARDS.map((c) => (
              <KpiCard key={c.title} {...c} value={0} empty />
            ))}
          </div>
        </section>

        {/* Bento: Funnel + Handoff reasons */}
        <div className="analytics-bento-top">
          <ConversionFunnel data={EMPTY_FUNNEL} />
          <HandoffReasons />
        </div>

        {/* Heatmap full width */}
        <ActivityHeatmap data={EMPTY_HEATMAP} />
      </div>
    </div>
  );
}
