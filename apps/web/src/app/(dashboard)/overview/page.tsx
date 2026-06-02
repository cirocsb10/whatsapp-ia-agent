"use client";

import { Header } from "@/components/layout/Header";
import { KpiCard } from "@/components/analytics/KpiCard";
import { ConversationsChart } from "@/components/analytics/ConversationsChart";
import Link from "next/link";
import { useApi } from "@/lib/hooks/useApi";
import { useEffect, useState } from "react";
import {
  MessageSquare, Zap, DollarSign, PhoneCall,
  Users, ShoppingCart, TrendingUp, Clock,
  CheckCircle2, Star, Database, Wifi,
  AlertTriangle, ArrowRight, Bot, Sparkles, Cpu,
} from "lucide-react";

const CARDS = [
  { key: "conversations_today", title: "Conversas Hoje", icon: MessageSquare, iconColor: "text-indigo-400", accent: "#6366f1" },
  { key: "ai_resolution_rate", title: "Resolucao por IA", icon: Zap, iconColor: "text-green-400", accent: "#22c55e", suffix: "%" },
  { key: "revenue_today", title: "Receita do Dia", icon: DollarSign, iconColor: "text-yellow-400", accent: "#fbbf24", money: true },
  { key: "pending_handoffs", title: "Handoffs Pendentes", icon: PhoneCall, iconColor: "text-red-400", accent: "#ef4444" },
  { key: "avg_response_time_sec", title: "Tempo Medio Resp.", icon: Clock, iconColor: "text-cyan-400", accent: "#06b6d4", suffix: "s" },
  { key: "new_contacts_today", title: "Novos Contatos", icon: Users, iconColor: "text-violet-400", accent: "#8b5cf6" },
  { key: "orders_today", title: "Pedidos Hoje", icon: ShoppingCart, iconColor: "text-orange-400", accent: "#f97316" },
  { key: "conversion_rate", title: "Taxa Conversao", icon: TrendingUp, iconColor: "text-emerald-400", accent: "#10b981", suffix: "%" },
  { key: "avg_csat_score", title: "CSAT (7 dias)", icon: Star, iconColor: "text-yellow-400", accent: "#fbbf24", csat: true },
  { key: "ai_tokens_today", title: "Tokens hoje", icon: Cpu, iconColor: "text-indigo-400", accent: "#6366f1", tokens: true },
];

const AGENT_STATUS = [
  { label: "Resolucao IA", icon: CheckCircle2, color: "#6366f1", key: "ai_resolution_rate" },
  { label: "Satisfacao CSAT", icon: Star, color: "#22c55e", key: "avg_csat_score", csat: true },
  { label: "Precisao NLP", icon: Database, color: "#06b6d4" },
  { label: "Uptime API", icon: Wifi, color: "#f59e0b" },
];

const SETUP_STEPS = ["Meta Business", "Agente IA", "Webhook"];

export default function OverviewPage() {
  const { apiFetch } = useApi();
  const [kpis, setKpis] = useState<Record<string, number | null>>({});
  const [chart, setChart] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [kpiRes, chartRes] = await Promise.all([
          apiFetch("/analytics/kpis"),
          apiFetch("/analytics/conversations-chart?days=30"),
        ]);
        if (kpiRes.ok) setKpis(await kpiRes.json());
        if (chartRes.ok) setChart(await chartRes.json());
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const date = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });
  const isActive = (kpis.conversations_today ?? 0) > 0;

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

  return (
    <div className="fade-up">
      <Header title="Overview" />

      <div className="dashboard-page">
        <div className="dashboard-greeting">
          <div>
            <p className="dashboard-greeting-title">Painel operacional</p>
            <p className="dashboard-greeting-sub">
              {date} - Acompanhe conversas, vendas e performance do seu agente IA.
            </p>
          </div>
          <div className="dashboard-status-pill">
            <span className="dashboard-status-dot" />
            {isActive ? "Agente ativo" : "Agente inativo"}
          </div>
        </div>

        <div className="dashboard-setup-banner">
          <div className="dashboard-setup-icon">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[#e2e8f0] leading-tight">
              Configure o WhatsApp para ver dados reais
            </p>
            <p className="text-[11px] text-[#64748b] mt-1 leading-relaxed">
              Complete o setup para ativar metricas, graficos e automacoes.
            </p>
            <div className="dashboard-setup-steps">
              {SETUP_STEPS.map((step) => (
                <span key={step} className="dashboard-setup-step">{step}</span>
              ))}
            </div>
          </div>
          <Link href="/setup" className="dashboard-setup-cta">
            <Sparkles className="w-3.5 h-3.5" />
            Comecar setup
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <section>
          <div className="dashboard-section-head">
            <p className="section-title">Metricas de hoje</p>
            <span className="text-[10px] text-[#475569]">Atualizado em tempo real</span>
          </div>
          <div className="dashboard-kpi-grid">
            {CARDS.map((card) => {
              const { key: metricKey, ...cardProps } = card;
              return (
                <KpiCard
                  key={card.title}
                  {...cardProps}
                  value={formatCard(card)}
                  loading={loading}
                  empty={!loading && isCardEmpty(card)}
                />
              );
            })}
          </div>
        </section>

        <div className="dashboard-bento">
          <ConversationsChart data={chart} />

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
                      <div className="prog-fill" style={{ width: `${barWidth}%`, background: color, opacity: 0.55 }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <Link href="/agent" className="dashboard-agent-link">
              Configurar agente
              <ArrowRight className="w-3 h-3" strokeWidth={1.8} />
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
