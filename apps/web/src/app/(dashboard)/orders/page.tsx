"use client";
import { Header } from "@/components/layout/Header";
import {
  ShoppingCart, Plus, Search, SlidersHorizontal,
  Package, TrendingUp, DollarSign, Clock,
  CheckCircle2, XCircle, Loader2, Download,
  ArrowRight, ChevronRight, User, Hash,
  MoreHorizontal, ExternalLink, Truck,
} from "lucide-react";
import { useState } from "react";

type StatusFilter = "all" | "pending" | "processing" | "delivered" | "cancelled";

const STATS = [
  { label: "Total de pedidos",  value: "0",    icon: ShoppingCart, color: "#6366f1", bg: "rgba(99,102,241,0.1)",  border: "rgba(99,102,241,0.2)"  },
  { label: "Pedidos hoje",      value: "0",    icon: TrendingUp,   color: "#22c55e", bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.2)"   },
  { label: "Receita total",     value: "R$ 0", icon: DollarSign,   color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.2)"  },
  { label: "Aguardando",        value: "0",    icon: Clock,        color: "#f43f5e", bg: "rgba(244,63,94,0.1)",   border: "rgba(244,63,94,0.2)"   },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  pending:    { label: "Pendente",      color: "#fbbf24", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.2)", icon: Clock       },
  processing: { label: "Em andamento",  color: "#818cf8", bg: "rgba(99,102,241,0.1)", border: "rgba(99,102,241,0.2)", icon: Loader2     },
  delivered:  { label: "Entregue",      color: "#4ade80", bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.2)",  icon: CheckCircle2},
  cancelled:  { label: "Cancelado",     color: "#f87171", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.2)",  icon: XCircle     },
};

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all",        label: "Todos"        },
  { key: "pending",    label: "Pendentes"    },
  { key: "processing", label: "Em andamento" },
  { key: "delivered",  label: "Entregues"    },
  { key: "cancelled",  label: "Cancelados"   },
];

const TABLE_COLS = ["Pedido", "Cliente", "Produtos", "Total", "Status", "Data", ""];

export default function OrdersPage() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const isEmpty = true;

  return (
    <div className="fade-up flex flex-col h-screen overflow-y-auto">
      <Header title="Pedidos" subtitle="Gerencie pedidos gerados pelo agente IA" />

      <div className="dashboard-page">

        {/* ── Stats ─────────────────────────────────────────────── */}
        <div className="support-stats-grid">
          {STATS.map(({ label, value, icon: Icon, color, bg, border }) => (
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

        {/* ── Toolbar ───────────────────────────────────────────── */}
        <div className="catalog-toolbar">
          <div className="catalog-search-wrap">
            <Search className="catalog-search-icon" />
            <input
              className="catalog-search-input"
              placeholder="Buscar por cliente, produto ou nº do pedido…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="catalog-filter-tabs">
              {STATUS_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setStatus(t.key)}
                  className={`inbox-tab ${status === t.key ? "inbox-tab-active" : ""}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button className="inbox-filter-btn" title="Filtros avançados">
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
            <button className="inbox-filter-btn" title="Exportar CSV">
              <Download className="w-3.5 h-3.5" />
            </button>
            <button className="catalog-add-btn">
              <Plus className="w-3.5 h-3.5" />
              Novo pedido
            </button>
          </div>
        </div>

        {/* ── Orders panel ──────────────────────────────────────── */}
        <div className="orders-panel">

          {/* Table header */}
          <div className="orders-table-head">
            {TABLE_COLS.map((col) => (
              <div key={col} className="orders-th">{col}</div>
            ))}
          </div>

          {/* Empty state */}
          {isEmpty && (
            <div className="orders-empty">
              <div className="orders-empty-glow" />

              <div className="orders-empty-icon-wrap">
                <div className="orders-empty-icon">
                  <ShoppingCart className="w-7 h-7" style={{ color: "#475569" }} strokeWidth={1.5} />
                </div>
                <div className="orders-empty-ring" />
              </div>

              <div className="orders-empty-text">
                <p className="text-[15px] font-semibold text-[#e2e8f0] leading-tight">
                  Nenhum pedido encontrado
                </p>
                <p className="text-[12px] text-[#475569] leading-relaxed text-center max-w-[300px]">
                  Pedidos criados pelo agente IA durante conversas no WhatsApp aparecerão aqui com links de pagamento automáticos.
                </p>
              </div>

              {/* Flow preview */}
              <div className="orders-flow-preview">
                {(["pending", "processing", "delivered"] as const).map((key, i, arr) => {
                  const cfg = STATUS_CONFIG[key]!;
                  const { label, color, bg, border, icon: Icon } = cfg;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="orders-flow-step" style={{ color, background: bg, borderColor: border }}>
                        <Icon className="w-3 h-3" strokeWidth={2} />
                        {label}
                      </span>
                      {i < arr.length - 1 && (
                        <ArrowRight className="w-3 h-3 shrink-0" style={{ color: "#1a2d47" }} />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 mt-1">
                <button className="orders-ghost-btn">
                  <Package className="w-3.5 h-3.5" />
                  Ver catálogo
                </button>
                <button className="catalog-add-btn">
                  <Plus className="w-3.5 h-3.5" />
                  Criar pedido manual
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Info cards ────────────────────────────────────────── */}
        <div className="support-info-row">
          <div className="support-info-card">
            <div className="support-info-card-header">
              <div className="support-info-icon" style={{ background: "rgba(99,102,241,0.1)", borderColor: "rgba(99,102,241,0.2)" }}>
                <ShoppingCart className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.8} />
              </div>
              <span className="text-[12px] font-semibold text-[#e2e8f0]">Como os pedidos funcionam</span>
            </div>
            <p className="text-[11px] text-[#64748b] leading-relaxed">
              O agente IA cria pedidos automaticamente durante conversas no WhatsApp. Cada pedido gera um link de pagamento via MercadoPago e fica disponível para acompanhamento em tempo real.
            </p>
          </div>

          <div className="support-info-card">
            <div className="support-info-card-header">
              <div className="support-info-icon" style={{ background: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.2)" }}>
                <Truck className="w-3.5 h-3.5 text-green-400" strokeWidth={1.8} />
              </div>
              <span className="text-[12px] font-semibold text-[#e2e8f0]">Rastreamento de status</span>
            </div>
            <p className="text-[11px] text-[#64748b] leading-relaxed">
              Atualize o status dos pedidos manualmente ou via webhook de pagamento. O agente notifica o cliente automaticamente via WhatsApp em cada mudança de status.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
