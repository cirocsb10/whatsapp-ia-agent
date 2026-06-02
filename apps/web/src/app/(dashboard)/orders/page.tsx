"use client";

import { Header } from "@/components/layout/Header";
import { useApi } from "@/lib/hooks/useApi";
import { useEffect, useMemo, useState } from "react";
import {
  ShoppingCart, Plus, Search, SlidersHorizontal,
  Package, TrendingUp, DollarSign, Clock,
  CheckCircle2, XCircle, Loader2, Download,
  ArrowRight, MoreHorizontal, Truck,
} from "lucide-react";

type StatusFilter = "all" | "pending" | "processing" | "delivered" | "cancelled";

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalCents: number;
  createdAt: string;
  contact?: { phone: string; name?: string };
  items?: Array<{ productName: string; quantity: number }>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  pending: { label: "Pendente", color: "#fbbf24", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.2)", icon: Clock },
  processing: { label: "Em andamento", color: "#818cf8", bg: "rgba(99,102,241,0.1)", border: "rgba(99,102,241,0.2)", icon: Loader2 },
  delivered: { label: "Entregue", color: "#4ade80", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.2)", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", color: "#f87171", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)", icon: XCircle },
};

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Pendentes" },
  { key: "processing", label: "Em andamento" },
  { key: "delivered", label: "Entregues" },
  { key: "cancelled", label: "Cancelados" },
];

const TABLE_COLS = ["Pedido", "Cliente", "Produtos", "Total", "Status", "Data", ""];

function normalizeStatus(status: string): StatusFilter {
  if (["DRAFT", "AWAITING_PAYMENT", "PAYMENT_CONFIRMED"].includes(status)) return "pending";
  if (["PROCESSING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"].includes(status)) return "processing";
  if (status === "DELIVERED") return "delivered";
  if (["CANCELLED", "REFUNDED"].includes(status)) return "cancelled";
  return "pending";
}

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function OrdersPage() {
  const { apiFetch } = useApi();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await apiFetch(`/orders?page=${page}&limit=20`);
        if (res.ok) {
          const data = await res.json();
          setOrders(data.items ?? []);
          setTotalPages(data.totalPages ?? 1);
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => orders.filter((order) => {
    const orderStatus = normalizeStatus(order.status);
    const text = `${order.orderNumber} ${order.contact?.name ?? ""} ${order.contact?.phone ?? ""} ${(order.items ?? []).map((i) => i.productName).join(" ")}`.toLowerCase();
    return (status === "all" || orderStatus === status) && (!search || text.includes(search.toLowerCase()));
  }), [orders, search, status]);

  const stats = [
    { label: "Total de pedidos", value: String(orders.length), icon: ShoppingCart, color: "#6366f1", bg: "rgba(99,102,241,0.1)", border: "rgba(99,102,241,0.2)" },
    { label: "Pedidos hoje", value: String(orders.filter((o) => new Date(o.createdAt).toDateString() === new Date().toDateString()).length), icon: TrendingUp, color: "#22c55e", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.2)" },
    { label: "Receita total", value: money(orders.reduce((sum, o) => sum + o.totalCents, 0)), icon: DollarSign, color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)" },
    { label: "Aguardando", value: String(orders.filter((o) => normalizeStatus(o.status) === "pending").length), icon: Clock, color: "#f43f5e", bg: "rgba(244,63,94,0.1)", border: "rgba(244,63,94,0.2)" },
  ];

  return (
    <div className="fade-up flex flex-col h-screen overflow-y-auto">
      <Header title="Pedidos" subtitle="Gerencie pedidos gerados pelo agente IA" />

      <div className="dashboard-page">
        <div className="support-stats-grid">
          {stats.map(({ label, value, icon: Icon, color, bg, border }) => (
            <div key={label} className="support-stat-card" style={{ "--stat-border": border } as React.CSSProperties}>
              <div className="support-stat-icon" style={{ background: bg, borderColor: border }}>
                <Icon className="w-4 h-4" style={{ color }} strokeWidth={1.8} />
              </div>
              <div>
                <p className="support-stat-value">{loading ? "..." : value}</p>
                <p className="support-stat-label">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="catalog-toolbar">
          <div className="catalog-search-wrap">
            <Search className="catalog-search-icon" />
            <input
              className="catalog-search-input"
              placeholder="Buscar por cliente, produto ou numero do pedido..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="catalog-filter-tabs">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatus(tab.key)}
                  className={`inbox-tab ${status === tab.key ? "inbox-tab-active" : ""}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button className="inbox-filter-btn" title="Filtros avancados">
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

        <div className="orders-panel">
          <div className="orders-table-head">
            {TABLE_COLS.map((col) => (
              <div key={col} className="orders-th">{col}</div>
            ))}
          </div>

          {filtered.length === 0 ? (
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
                  {loading ? "Carregando pedidos..." : "Nenhum pedido encontrado"}
                </p>
                <p className="text-[12px] text-[#475569] leading-relaxed text-center max-w-[300px]">
                  Pedidos criados pelo agente IA durante conversas no WhatsApp aparecerao aqui.
                </p>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <button className="orders-ghost-btn">
                  <Package className="w-3.5 h-3.5" />
                  Ver catalogo
                </button>
                <button className="catalog-add-btn">
                  <Plus className="w-3.5 h-3.5" />
                  Criar pedido manual
                </button>
              </div>
            </div>
          ) : (
            <div>
              {filtered.map((order) => {
                const cfg = STATUS_CONFIG[normalizeStatus(order.status)] ?? STATUS_CONFIG.pending!;
                const StatusIcon = cfg.icon;
                return (
                  <div
                    key={order.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.1fr 1.2fr 1.4fr .8fr 1fr .9fr 40px",
                      alignItems: "center",
                      borderTop: "1px solid rgba(26,45,71,.7)",
                    }}
                  >
                    <div className="orders-td font-mono">{order.orderNumber}</div>
                    <div className="orders-td">{order.contact?.name ?? order.contact?.phone ?? "-"}</div>
                    <div className="orders-td">
                      {(order.items ?? []).map((i) => `${i.quantity}x ${i.productName}`).join(", ") || "-"}
                    </div>
                    <div className="orders-td">{money(order.totalCents)}</div>
                    <div className="orders-td">
                      <span className="orders-flow-step" style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
                        <StatusIcon className="w-3 h-3" strokeWidth={2} />
                        {cfg.label}
                      </span>
                    </div>
                    <div className="orders-td">
                      {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                    </div>
                    <div className="orders-td">
                      <MoreHorizontal className="w-4 h-4 text-[#64748b]" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="inbox-filter-btn disabled:opacity-40">
            Anterior
          </button>
          <span className="text-[11px] text-[#64748b]">Pagina {page} de {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="inbox-filter-btn disabled:opacity-40">
            Proxima
          </button>
        </div>

        <div className="support-info-row">
          <div className="support-info-card">
            <div className="support-info-card-header">
              <div className="support-info-icon" style={{ background: "rgba(99,102,241,0.1)", borderColor: "rgba(99,102,241,0.2)" }}>
                <ShoppingCart className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.8} />
              </div>
              <span className="text-[12px] font-semibold text-[#e2e8f0]">Como os pedidos funcionam</span>
            </div>
            <p className="text-[11px] text-[#64748b] leading-relaxed">
              O agente IA cria pedidos automaticamente durante conversas no WhatsApp.
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
              Atualize status manualmente ou por webhook de pagamento.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
