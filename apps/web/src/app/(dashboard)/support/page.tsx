"use client";
import { Header } from "@/components/layout/Header";
import { useInboxStore } from "@/lib/store/inbox.store";
import {
  PhoneCall, Bot, Clock, CheckCircle2,
  User, ArrowRight, Inbox, MessageSquare,
  AlertCircle, LifeBuoy,
} from "lucide-react";
import { useState } from "react";

function relativeTime(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function getInitials(name?: string, phone?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
    }
    return (parts[0] ?? "").slice(0, 2).toUpperCase();
  }
  return phone?.slice(-2) ?? "??";
}

const ACCENT_PALETTE = [
  "#6366f1", "#22c55e", "#06b6d4", "#f59e0b",
  "#ec4899", "#8b5cf6", "#14b8a6", "#f97316",
];
function accentFor(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) & 0xffffffff;
  return ACCENT_PALETTE[Math.abs(n) % ACCENT_PALETTE.length];
}

type SupportTab = "pending" | "active" | "resolved";

export default function SupportPage() {
  const conversations = useInboxStore((s) => s.conversations);
  const [tab, setTab] = useState<SupportTab>("pending");

  const handoffs = conversations.filter((c) => c.isHandoff);
  const aiActive = conversations.filter((c) => !c.isHandoff);

  const pendingHandoffs = handoffs.filter((c) => c.status === "HUMAN_HANDOFF");
  const resolvedToday: typeof conversations = [];

  const tabItems: { key: SupportTab; label: string; count: number; icon: typeof PhoneCall }[] = [
    { key: "pending",  label: "Aguardando",  count: pendingHandoffs.length, icon: AlertCircle },
    { key: "active",   label: "Em andamento", count: 0,                     icon: MessageSquare },
    { key: "resolved", label: "Resolvidos",   count: resolvedToday.length,  icon: CheckCircle2 },
  ];

  const visibleList =
    tab === "pending" ? pendingHandoffs :
    tab === "resolved" ? resolvedToday : [];

  const stats = [
    { label: "Aguardando atendimento", value: pendingHandoffs.length, icon: PhoneCall,    color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.2)"  },
    { label: "IA respondendo agora",   value: aiActive.length,        icon: Bot,          color: "#6366f1", bg: "rgba(99,102,241,0.1)",  border: "rgba(99,102,241,0.2)"  },
    { label: "Resolvidos hoje",         value: resolvedToday.length,   icon: CheckCircle2, color: "#22c55e", bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.2)"   },
    { label: "Tempo médio resposta",    value: "—",                    icon: Clock,        color: "#06b6d4", bg: "rgba(6,182,212,0.1)",   border: "rgba(6,182,212,0.2)"   },
  ];

  return (
    <div className="fade-up flex flex-col h-screen">
      <Header title="Suporte" subtitle="Gestão de atendimentos e handoffs" />

      <div className="dashboard-page">
        {/* Stats row */}
        <div className="support-stats-grid">
          {stats.map(({ label, value, icon: Icon, color, bg, border }) => (
            <div key={label} className="support-stat-card" style={{ "--stat-border": border } as React.CSSProperties}>
              <div className="support-stat-icon" style={{ background: bg, borderColor: border }}>
                <Icon className="w-4 h-4" style={{ color }} strokeWidth={1.8} />
              </div>
              <div>
                <p className="support-stat-value">{value}</p>
                <p className="support-stat-label">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs + list */}
        <div className="support-panel">
          {/* Panel header */}
          <div className="support-panel-header">
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <LifeBuoy className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.8} />
              </div>
              <span className="text-[13px] font-semibold text-[#e2e8f0]">Fila de atendimento</span>
            </div>
            <div className="support-tabs">
              {tabItems.map(({ key, label, count, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`support-tab ${tab === key ? "support-tab-active" : ""}`}
                >
                  <Icon className="w-3 h-3" strokeWidth={1.8} />
                  {label}
                  {count > 0 && (
                    <span className={`inbox-tab-count ${tab === key ? "inbox-tab-count-active" : ""}`}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {visibleList.length === 0 ? (
            <div className="support-empty">
              <div className="support-empty-icon">
                {tab === "pending"
                  ? <PhoneCall className="w-6 h-6 text-slate-600" />
                  : tab === "resolved"
                  ? <CheckCircle2 className="w-6 h-6 text-slate-600" />
                  : <MessageSquare className="w-6 h-6 text-slate-600" />
                }
              </div>
              <p className="text-[14px] font-semibold text-[#e2e8f0]">
                {tab === "pending" ? "Nenhum handoff pendente" :
                 tab === "active"  ? "Nenhum atendimento ativo" :
                                     "Nenhuma conversa resolvida hoje"}
              </p>
              <p className="text-[12px] text-[#475569] leading-relaxed max-w-xs text-center">
                {tab === "pending"
                  ? "Quando o agente IA precisar de suporte humano, as conversas aparecerão aqui."
                  : tab === "active"
                  ? "Atendimentos em andamento serão exibidos aqui."
                  : "Conversas marcadas como resolvidas hoje aparecerão aqui."}
              </p>
            </div>
          ) : (
            <div className="support-list">
              {visibleList.map((conv) => {
                const accent = accentFor(conv.id);
                const initials = getInitials(conv.contact.name, conv.contact.phone);
                return (
                  <div key={conv.id} className="support-conv-row">
                    {/* Avatar */}
                    <div
                      className="inbox-avatar"
                      style={{ background: `${accent}18`, borderColor: `${accent}30`, color: accent }}
                    >
                      {initials}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-[13px] font-semibold text-[#f1f5f9]">
                          {conv.contact.name ?? conv.contact.phone}
                        </span>
                        <span className="inbox-status-tag inbox-status-handoff">
                          <PhoneCall className="w-2.5 h-2.5" />
                          Handoff
                        </span>
                      </div>
                      {conv.contact.name && (
                        <p className="text-[11px] text-[#475569] font-mono mb-1">{conv.contact.phone}</p>
                      )}
                      <p className="text-[12px] text-[#64748b] truncate">
                        {conv.lastMessage ?? "Sem mensagens"}
                      </p>
                    </div>

                    {/* Right meta */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className="text-[10px] text-[#475569] tabular-nums">
                        {relativeTime(conv.lastMessageAt)}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span className="inbox-badge">{conv.unreadCount > 9 ? "9+" : conv.unreadCount}</span>
                      )}
                      <button className="support-attend-btn">
                        Atender
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info panel */}
        <div className="support-info-row">
          <div className="support-info-card">
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: 10 }}>
              <div className="support-info-icon" style={{ background: "rgba(99,102,241,0.1)", borderColor: "rgba(99,102,241,0.2)" }}>
                <Bot className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.8} />
              </div>
              <span className="text-[12px] font-semibold text-[#e2e8f0]">Como funciona o handoff</span>
            </div>
            <p className="text-[11px] text-[#64748b] leading-relaxed">
              Quando o agente IA detecta que uma conversa precisa de atenção humana — por frustração do cliente, pergunta complexa ou solicitação explícita — ele transfere automaticamente para esta fila.
            </p>
          </div>

          <div className="support-info-card">
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: 10 }}>
              <div className="support-info-icon" style={{ background: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.2)" }}>
                <User className="w-3.5 h-3.5 text-green-400" strokeWidth={1.8} />
              </div>
              <span className="text-[12px] font-semibold text-[#e2e8f0]">Retomada pela IA</span>
            </div>
            <p className="text-[11px] text-[#64748b] leading-relaxed">
              Após resolver o atendimento, você pode marcar como resolvido para o agente IA voltar a monitorar a conversa automaticamente para futuras interações.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
