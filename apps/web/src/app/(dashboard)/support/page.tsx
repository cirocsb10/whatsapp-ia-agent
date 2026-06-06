"use client";
import { Header } from "@/components/layout/Header";
import { useSocket } from "@/hooks/useSocket";
import { useApi } from "@/lib/hooks/useApi";
import { useInboxStore } from "@/lib/store/inbox.store";
import {
  PhoneCall, Bot, Clock, CheckCircle2,
  User, ArrowRight, MessageSquare, ChevronRight,
  AlertCircle, LifeBuoy, Search,
  Sparkles, Headphones, Zap, RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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

function waitMinutes(iso?: string): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
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

const STATS = [
  { key: "pending",  label: "Aguardando atendimento", icon: PhoneCall,    color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.25)"  },
  { key: "ai",       label: "IA respondendo agora",     icon: Bot,          color: "#6366f1", bg: "rgba(99,102,241,0.12)",  border: "rgba(99,102,241,0.25)"  },
  { key: "resolved", label: "Resolvidos hoje",          icon: CheckCircle2, color: "#22c55e", bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.25)"   },
  { key: "avg",      label: "Tempo médio resposta",     icon: Clock,        color: "#06b6d4", bg: "rgba(6,182,212,0.12)",   border: "rgba(6,182,212,0.25)"   },
] as const;

export default function SupportPage() {
  useSocket();
  const router = useRouter();
  const { apiFetch } = useApi();
  const conversations = useInboxStore((s) => s.conversations);
  const setConversations = useInboxStore((s) => s.setConversations);
  const socketStatus = useInboxStore((s) => s.socketStatus);
  const [tab, setTab] = useState<SupportTab>("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  function handleAttend(convId: string) {
    router.push(`/inbox?conv=${encodeURIComponent(convId)}`);
  }

  async function loadConversations() {
    setLoading(true);
    try {
      const res = await apiFetch("/conversations");
      if (res.ok) setConversations(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConversations();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handoffs = conversations.filter((c) => c.isHandoff);
  const aiActive = conversations.filter((c) => !c.isHandoff);

  const pendingHandoffs = handoffs.filter((c) => c.status === "HUMAN_HANDOFF" && !c.isAssumed);
  const activeHandoffs = handoffs.filter((c) => c.status === "HUMAN_HANDOFF" && c.isAssumed);
  const resolvedToday: typeof conversations = [];

  const tabItems: { key: SupportTab; label: string; count: number; icon: typeof PhoneCall }[] = [
    { key: "pending",  label: "Aguardando",   count: pendingHandoffs.length, icon: AlertCircle },
    { key: "active",   label: "Em andamento", count: activeHandoffs.length,  icon: Headphones },
    { key: "resolved", label: "Resolvidos",   count: resolvedToday.length,   icon: CheckCircle2 },
  ];

  const visibleList = useMemo(() => {
    const base =
      tab === "pending" ? pendingHandoffs :
      tab === "active"  ? activeHandoffs :
                          resolvedToday;
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter((c) =>
      (c.contact.name ?? "").toLowerCase().includes(q) ||
      c.contact.phone.includes(q) ||
      (c.lastMessage ?? "").toLowerCase().includes(q)
    );
  }, [tab, pendingHandoffs, activeHandoffs, resolvedToday, search]);

  const statValues: Record<string, string | number> = {
    pending: pendingHandoffs.length,
    ai: aiActive.length,
    resolved: resolvedToday.length,
    avg: "—",
  };

  const hasUrgent = pendingHandoffs.some((c) => waitMinutes(c.lastMessageAt) >= 5);
  const isLive = socketStatus === "connected";

  const date = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="fade-up flex flex-col h-screen">
      <Header title="Suporte" subtitle="Gestão de atendimentos e handoffs" />

      <div className="dashboard-page support-page">
        {/* Hero */}
        <div className="support-hero">
          <div className="support-hero-content">
            <div className="support-hero-badge">
              <Sparkles className="w-3 h-3" strokeWidth={2} />
              Central de atendimento
            </div>
            <h2 className="support-hero-title">Fila de handoffs</h2>
            <p className="support-hero-sub">
              {date} — Monitore transferências da IA e assuma conversas que precisam de atenção humana.
            </p>
          </div>
          <div className="support-hero-actions">
            <div className={`support-live-pill ${isLive ? "support-live-pill--on" : ""}`}>
              <span className="support-live-dot" />
              {isLive ? "Tempo real ativo" : "Reconectando…"}
            </div>
            <button
              type="button"
              onClick={() => void loadConversations()}
              className="support-refresh-btn"
              aria-label="Atualizar fila"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Urgency banner */}
        {pendingHandoffs.length > 0 && (
          <div className={`support-alert ${hasUrgent ? "support-alert--urgent" : ""}`}>
            <div className="support-alert-icon">
              {hasUrgent
                ? <Zap className="w-4 h-4 text-amber-400" strokeWidth={2} />
                : <AlertCircle className="w-4 h-4 text-amber-400" strokeWidth={2} />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="support-alert-title">
                {pendingHandoffs.length === 1
                  ? "1 cliente aguardando atendimento humano"
                  : `${pendingHandoffs.length} clientes aguardando atendimento humano`}
              </p>
              <p className="support-alert-sub">
                {hasUrgent
                  ? "Há conversas com tempo de espera elevado. Priorize o atendimento."
                  : "A IA transferiu conversas que precisam de um operador."}
              </p>
            </div>
            {pendingHandoffs[0] && (
              <button
                type="button"
                onClick={() => handleAttend(pendingHandoffs[0]!.id)}
                className="support-alert-cta"
              >
                Atender agora
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="support-stats-grid">
          {STATS.map(({ key, label, icon: Icon, color, bg, border }) => (
            <div
              key={key}
              className="support-stat-card"
              style={{
                "--stat-accent": color,
                "--stat-border": border,
                "--stat-glow": `${color}18`,
              } as React.CSSProperties}
            >
              <div className="support-stat-glow" aria-hidden="true" />
              <div className="support-stat-icon" style={{ background: bg, borderColor: border }}>
                <Icon className="w-4 h-4" style={{ color }} strokeWidth={1.8} />
              </div>
              <div className="support-stat-body">
                <p className="support-stat-value">{loading ? "…" : statValues[key]}</p>
                <p className="support-stat-label">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Queue panel */}
        <div className="support-panel">
          <div className="support-panel-header">
            <div className="support-panel-title">
              <div className="support-panel-title-icon">
                <LifeBuoy className="w-4 h-4 text-amber-400" strokeWidth={1.8} />
              </div>
              <div>
                <span className="support-panel-title-text">Fila de atendimento</span>
                <span className="support-panel-title-meta">
                  {pendingHandoffs.length + activeHandoffs.length} na fila
                </span>
              </div>
            </div>

            <div className="support-panel-toolbar">
              <div className="support-search">
                <Search className="support-search-icon" strokeWidth={1.8} />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome, telefone…"
                  className="support-search-input"
                  aria-label="Buscar na fila"
                />
              </div>
              <div className="support-tabs" role="tablist">
                {tabItems.map(({ key, label, count, icon: Icon }) => (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => setTab(key)}
                    className={`support-tab ${tab === key ? "support-tab-active" : ""}`}
                  >
                    <Icon className="w-3 h-3" strokeWidth={1.8} />
                    {label}
                    {count > 0 && (
                      <span className={`support-tab-count ${tab === key ? "support-tab-count-active" : ""}`}>
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="support-skeleton-list">
              {[1, 2, 3].map((i) => (
                <div key={i} className="support-skeleton-row">
                  <div className="shimmer w-12 h-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="shimmer h-3 w-32 rounded" />
                    <div className="shimmer h-2.5 w-48 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : visibleList.length === 0 ? (
            <div className="support-empty">
              <div className="support-empty-glow" aria-hidden="true" />
              <div className="support-empty-icon">
                {tab === "pending"
                  ? <PhoneCall className="w-6 h-6 text-slate-500" />
                  : tab === "resolved"
                  ? <CheckCircle2 className="w-6 h-6 text-slate-500" />
                  : <MessageSquare className="w-6 h-6 text-slate-500" />
                }
              </div>
              <p className="support-empty-title">
                {search.trim()
                  ? "Nenhum resultado encontrado"
                  : tab === "pending" ? "Nenhum handoff pendente" :
                    tab === "active"  ? "Nenhum atendimento ativo" :
                                        "Nenhuma conversa resolvida hoje"}
              </p>
              <p className="support-empty-desc">
                {search.trim()
                  ? "Tente outro termo de busca ou limpe o filtro."
                  : tab === "pending"
                  ? "Quando o agente IA precisar de suporte humano, as conversas aparecerão aqui automaticamente."
                  : tab === "active"
                  ? "Atendimentos em andamento serão exibidos aqui após você assumir uma conversa."
                  : "Conversas marcadas como resolvidas hoje aparecerão aqui."}
              </p>
              {tab === "pending" && !search.trim() && (
                <Link href="/inbox" className="support-empty-link">
                  Ver todas as conversas
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          ) : (
            <div className="support-list">
              {visibleList.map((conv) => {
                const accent = accentFor(conv.id);
                const initials = getInitials(conv.contact.name, conv.contact.phone);
                const wait = waitMinutes(conv.lastMessageAt);
                const isUrgent = tab === "pending" && wait >= 5;
                return (
                  <article
                    key={conv.id}
                    className={`support-conv-row ${isUrgent ? "support-conv-row--urgent" : ""} ${conv.isAssumed ? "support-conv-row--clickable" : ""}`}
                    {...(conv.isAssumed ? {
                      role: "button",
                      tabIndex: 0,
                      onClick: () => handleAttend(conv.id),
                      onKeyDown: (e: React.KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleAttend(conv.id);
                        }
                      },
                    } : {})}
                  >
                    <div
                      className="support-conv-accent"
                      style={{ background: isUrgent ? "#f59e0b" : accent }}
                      aria-hidden="true"
                    />

                    <div
                      className="inbox-avatar support-conv-avatar"
                      style={{ background: `${accent}18`, borderColor: `${accent}35`, color: accent }}
                    >
                      {initials}
                    </div>

                    <div className="support-conv-body">
                      <div className="support-conv-header">
                        <div className="support-conv-tags">
                          <span className="support-conv-name">
                            {conv.contact.name ?? conv.contact.phone}
                          </span>
                          <span className={`inbox-status-tag ${conv.isAssumed ? "inbox-status-ai" : "inbox-status-handoff"}`}>
                            {conv.isAssumed
                              ? <><Headphones className="w-2.5 h-2.5" /> Em atendimento</>
                              : <><PhoneCall className="w-2.5 h-2.5" /> Handoff</>
                            }
                          </span>
                          {isUrgent && (
                            <span className="support-urgency-tag">
                              <Zap className="w-2.5 h-2.5" />
                              Urgente
                            </span>
                          )}
                        </div>
                        <span className="support-conv-time">
                          <Clock className="w-3 h-3" strokeWidth={1.8} />
                          {relativeTime(conv.lastMessageAt)}
                        </span>
                      </div>
                      {conv.contact.name && (
                        <p className="support-conv-phone">{conv.contact.phone}</p>
                      )}
                      <p className="support-conv-preview">
                        {conv.lastMessage ?? "Sem mensagens"}
                      </p>
                    </div>

                    <div className={`support-conv-aside ${conv.isAssumed ? "support-conv-aside--nav" : "support-conv-aside--action"}`}>
                      {conv.unreadCount > 0 && (
                        <span className="inbox-badge">{conv.unreadCount > 9 ? "9+" : conv.unreadCount}</span>
                      )}
                      {conv.isAssumed ? (
                        <ChevronRight className="support-conv-chevron" strokeWidth={1.8} aria-hidden="true" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAttend(conv.id)}
                          className="support-attend-btn"
                        >
                          Atender
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Info cards */}
        <div className="support-info-row">
          <div className="support-info-card">
            <div className="support-info-card-glow support-info-card-glow--indigo" aria-hidden="true" />
            <div className="support-info-card-header">
              <div className="support-info-step">1</div>
              <div className="support-info-icon" style={{ background: "rgba(99,102,241,0.12)", borderColor: "rgba(99,102,241,0.25)" }}>
                <Bot className="w-4 h-4 text-indigo-400" strokeWidth={1.8} />
              </div>
              <span className="support-info-title">Como funciona o handoff</span>
            </div>
            <p className="support-info-desc">
              Quando o agente IA detecta frustração, pergunta complexa ou solicitação explícita,
              ele transfere automaticamente a conversa para esta fila de atendimento humano.
            </p>
          </div>

          <div className="support-info-card">
            <div className="support-info-card-glow support-info-card-glow--green" aria-hidden="true" />
            <div className="support-info-card-header">
              <div className="support-info-step">2</div>
              <div className="support-info-icon" style={{ background: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.25)" }}>
                <User className="w-4 h-4 text-green-400" strokeWidth={1.8} />
              </div>
              <span className="support-info-title">Retomada pela IA</span>
            </div>
            <p className="support-info-desc">
              Após resolver o atendimento, marque como resolvido para o agente IA voltar a monitorar
              a conversa e responder automaticamente em futuras interações.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
