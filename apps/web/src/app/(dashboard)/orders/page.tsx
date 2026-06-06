"use client";

import { Header } from "@/components/layout/Header";
import { OrderDetailModal } from "@/components/orders/OrderDetailModal";
import { UpdateStatusModal } from "@/components/orders/UpdateStatusModal";
import { CreateOrderModal } from "@/components/orders/CreateOrderModal";
import { useApi } from "@/lib/hooks/useApi";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShoppingCart, Search, SlidersHorizontal,
  TrendingUp, DollarSign, Clock,
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
  const router = useRouter();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [updateOrder, setUpdateOrder] = useState<{ id: string; status: string } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const loadOrders = useCallback(async () => {
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
  }, [apiFetch, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void loadOrders(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenuId]);

  function exportCsv() {
    const header = "Pedido,Cliente,Telefone,Total,Status,Data\n";
    const rows = orders.map((o) =>
      [
        o.orderNumber,
        o.contact?.name ?? "",
        o.contact?.phone ?? "",
        (o.totalCents / 100).toFixed(2),
        o.status,
        new Date(o.createdAt).toLocaleDateString("pt-BR"),
      ].join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
        <div className="orders-hero">
          <div className="orders-hero-content">
            <div className="orders-hero-badge">
              <ShoppingCart className="w-3 h-3" strokeWidth={2} />
              Central de pedidos
            </div>
            <h2 className="orders-hero-title">Pedidos do WhatsApp</h2>
            <p className="orders-hero-sub">
              Acompanhe pedidos criados pela IA, status de pagamento e próximas ações de entrega.
            </p>
          </div>
          <div className="orders-hero-actions">
            <button className="orders-btn orders-btn-primary" onClick={() => setCreateOpen(true)}>
              Novo pedido
            </button>
          </div>
        </div>

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
            <div className="orders-filter-tabs">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatus(tab.key)}
                  className={`orders-tab ${status === tab.key ? "orders-tab-active" : ""}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button className="orders-tool-btn" title="Filtros avancados">
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
            <button className="orders-tool-btn" title="Exportar CSV" onClick={exportCsv}>
              <Download className="w-3.5 h-3.5" />
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
                <button className="orders-btn orders-btn-secondary" onClick={() => router.push("/catalog")}>
                  Ver catalogo
                </button>
                <button className="orders-btn orders-btn-primary" onClick={() => setCreateOpen(true)}>
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
                    <div className="orders-td" style={{ position: "relative" }}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === order.id ? null : order.id); }}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex", alignItems: "center", color: "#64748b" }}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {openMenuId === order.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 50, background: "#0f172a", border: "1px solid rgba(51,65,85,0.8)", borderRadius: 10, padding: "4px 0", minWidth: 180, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
                        >
                          {[
                            { label: "Ver detalhes", action: () => { setDetailOrderId(order.id); setOpenMenuId(null); }, danger: false },
                            { label: "Atualizar status", action: () => { setUpdateOrder({ id: order.id, status: order.status }); setOpenMenuId(null); }, danger: false },
                            { label: "Cancelar pedido", action: async () => { setOpenMenuId(null); if (!confirm(`Cancelar ${order.orderNumber}?`)) return; await apiFetch(`/orders/${order.id}/cancel`, { method: "PATCH" }); void loadOrders(); }, danger: true },
                          ].map(({ label, action, danger }) => (
                            <button
                              key={label}
                              type="button"
                              onClick={action}
                              style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 13, color: danger ? "#f87171" : "#94a3b8", display: "block" }}
                              onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
                              onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = "none"; }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="orders-btn orders-btn-secondary disabled:opacity-40">
            Anterior
          </button>
          <span className="text-[11px] text-[#64748b]">Pagina {page} de {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="orders-btn orders-btn-secondary disabled:opacity-40">
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

      <CreateOrderModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); void loadOrders(); }}
      />
      <OrderDetailModal
        open={!!detailOrderId}
        onClose={() => setDetailOrderId(null)}
        orderId={detailOrderId}
      />
      <UpdateStatusModal
        open={!!updateOrder}
        onClose={() => setUpdateOrder(null)}
        onUpdated={() => void loadOrders()}
        orderId={updateOrder?.id ?? null}
        currentStatus={updateOrder?.status ?? "DRAFT"}
      />
    </div>
  );
}
