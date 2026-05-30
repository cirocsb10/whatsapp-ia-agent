import { Header } from "@/components/layout/Header";
import { KpiCard } from "@/components/analytics/KpiCard";
import { ConversationsChart } from "@/components/analytics/ConversationsChart";
import Link from "next/link";
import {
  MessageSquare, Zap, DollarSign, PhoneCall,
  Users, ShoppingCart, TrendingUp, Clock,
  CheckCircle2, Star, Database, Wifi,
  AlertTriangle, ArrowRight, Bot, Sparkles,
} from "lucide-react";

const CARDS = [
  { title: "Conversas Hoje",     icon: MessageSquare, iconColor: "text-indigo-400", accent: "#6366f1" },
  { title: "Resolução por IA",   icon: Zap,           iconColor: "text-green-400",  accent: "#22c55e" },
  { title: "Receita do Dia",     icon: DollarSign,    iconColor: "text-yellow-400", accent: "#fbbf24" },
  { title: "Handoffs Pendentes", icon: PhoneCall,     iconColor: "text-red-400",    accent: "#ef4444" },
  { title: "Tempo Médio Resp.",  icon: Clock,         iconColor: "text-cyan-400",   accent: "#06b6d4" },
  { title: "Novos Contatos",     icon: Users,         iconColor: "text-violet-400", accent: "#8b5cf6" },
  { title: "Pedidos Hoje",       icon: ShoppingCart,  iconColor: "text-orange-400", accent: "#f97316" },
  { title: "Taxa Conversão",     icon: TrendingUp,    iconColor: "text-emerald-400",accent: "#10b981" },
];

const AGENT_STATUS = [
  { label: "Resolução IA",    icon: CheckCircle2, color: "#6366f1" },
  { label: "Satisfação CSAT", icon: Star,         color: "#22c55e" },
  { label: "Precisão NLP",    icon: Database,     color: "#06b6d4" },
  { label: "Uptime API",      icon: Wifi,         color: "#f59e0b" },
];

const SETUP_STEPS = [
  "Meta Business",
  "Agente IA",
  "Webhook",
];

export default function OverviewPage() {
  const date = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="fade-up">
      <Header title="Overview" />

      <div className="dashboard-page">
        {/* Greeting */}
        <div className="dashboard-greeting">
          <div>
            <p className="dashboard-greeting-title">
              Painel operacional
            </p>
            <p className="dashboard-greeting-sub">
              {date} · Acompanhe conversas, vendas e performance do seu agente IA.
            </p>
          </div>
          <div className="dashboard-status-pill">
            <span className="dashboard-status-dot" />
            Agente inativo
          </div>
        </div>

        {/* Setup banner */}
        <div className="dashboard-setup-banner">
          <div className="dashboard-setup-icon">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[#e2e8f0] leading-tight">
              Configure o WhatsApp para ver dados reais
            </p>
            <p className="text-[11px] text-[#64748b] mt-1 leading-relaxed">
              Complete o setup para ativar métricas, gráficos e automações.
            </p>
            <div className="dashboard-setup-steps">
              {SETUP_STEPS.map((step) => (
                <span key={step} className="dashboard-setup-step">{step}</span>
              ))}
            </div>
          </div>
          <Link href="/setup" className="dashboard-setup-cta">
            <Sparkles className="w-3.5 h-3.5" />
            Começar setup
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* KPIs */}
        <section>
          <div className="dashboard-section-head">
            <p className="section-title">Métricas de hoje</p>
            <span className="text-[10px] text-[#475569]">Atualizado em tempo real</span>
          </div>
          <div className="dashboard-kpi-grid">
            {CARDS.map((c) => (
              <KpiCard key={c.title} {...c} value={0} empty />
            ))}
          </div>
        </section>

        {/* Chart + Agent Status */}
        <div className="dashboard-bento">
          <ConversationsChart data={[]} />

          <aside className="dashboard-agent-panel">
            <div className="dashboard-agent-header">
              <div className="dashboard-agent-icon">
                <Bot className="w-4 h-4" strokeWidth={1.8} />
              </div>
              <div className="dashboard-agent-header-text">
                <p className="dashboard-agent-title">Status do Agente</p>
                <p className="dashboard-agent-subtitle">Monitoramento em tempo real</p>
              </div>
              <span className="tag tag-slate shrink-0 mt-0.5">Inativo</span>
            </div>

            <div className="dashboard-agent-metrics">
              {AGENT_STATUS.map(({ label, icon: Icon, color }) => (
                <div key={label} className="dashboard-agent-metric">
                  <div className="dashboard-agent-metric-row">
                    <div className="dashboard-agent-metric-label">
                      <div className="dashboard-agent-metric-icon">
                        <Icon className="w-3 h-3" style={{ color }} strokeWidth={1.8} />
                      </div>
                      <span className="dashboard-agent-metric-name">{label}</span>
                    </div>
                    <span className="dashboard-agent-metric-value">—</span>
                  </div>
                  <div className="prog-track">
                    <div className="prog-fill" style={{ width: "0%", background: color, opacity: 0.55 }} />
                  </div>
                </div>
              ))}
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
