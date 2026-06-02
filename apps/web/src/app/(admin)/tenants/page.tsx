"use client";

import { Header } from "@/components/layout/Header";
import { KpiCard } from "@/components/analytics/KpiCard";
import { useApi } from "@/lib/hooks/useApi";
import { useCallback, useEffect, useState } from "react";
import {
  Ban,
  Building2,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  RotateCcw,
  Shield,
  Users,
  XCircle,
} from "lucide-react";

const PAGE_SIZE = 25;

interface TenantBilling {
  conversationsThisMonth: number;
  conversationsLimit: number;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELLED";
  planType: string;
  whatsappStatus: "CONNECTED" | "DISCONNECTED";
  billing: TenantBilling | null;
  _count: { conversations: number };
}

interface KPIs {
  total_tenants: number;
  active_tenants: number;
  total_conversations: number;
}

interface TenantsResponse {
  items: Tenant[];
  total: number;
}

type PendingAction = { tenantId: string; action: "suspend" | "activate"; tenantName: string };

const KPI_CONFIG = [
  {
    label: "Total Tenants",
    key: "total_tenants" as const,
    icon: Building2,
    iconColor: "text-orange-400",
    accent: "#f97316",
  },
  {
    label: "Tenants Ativos",
    key: "active_tenants" as const,
    icon: Users,
    iconColor: "text-green-400",
    accent: "#22c55e",
  },
  {
    label: "Conversas Total",
    key: "total_conversations" as const,
    icon: MessageSquare,
    iconColor: "text-indigo-400",
    accent: "#6366f1",
  },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "bg-green-500/10 text-green-400 border-green-500/25",
    TRIAL: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    SUSPENDED: "bg-red-500/10 text-red-400 border-red-500/25",
    CANCELLED: "bg-slate-800/80 text-slate-500 border-slate-600/50",
  };
  const labels: Record<string, string> = {
    ACTIVE: "Ativo",
    TRIAL: "Trial",
    SUSPENDED: "Suspenso",
    CANCELLED: "Cancelado",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${styles[status] ?? styles.SUSPENDED}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function usageBarColor(pct: number): string {
  if (pct >= 90) return "#ef4444";
  if (pct >= 70) return "#f59e0b";
  return "#22c55e";
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="super-admin-table-row">
          <td colSpan={6}>
            <div className="flex gap-4 py-1">
              <div className="shimmer h-8 w-40 rounded" />
              <div className="shimmer h-6 w-16 rounded-full ml-auto" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

export default function TenantsPage() {
  const { apiFetch } = useApi();
  const [kpis, setKpis] = useState<KPIs>({
    total_tenants: 0,
    active_tenants: 0,
    total_conversations: 0,
  });
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const [kpiRes, tenantsRes] = await Promise.all([
          apiFetch("/super-admin/kpis"),
          apiFetch(`/super-admin/tenants?page=${p}&limit=${PAGE_SIZE}`),
        ]);
        if (kpiRes.ok) setKpis((await kpiRes.json()) as KPIs);
        if (tenantsRes.ok) {
          const data = (await tenantsRes.json()) as TenantsResponse;
          setTenants(data.items);
          setTotal(data.total);
        }
      } finally {
        setLoading(false);
      }
    },
    [apiFetch],
  );

  useEffect(() => {
    void load(page);
  }, [page, load]);

  async function confirmAction() {
    if (!pending) return;
    const { tenantId, action } = pending;
    setPending(null);
    setActionLoading(tenantId);
    try {
      const res = await apiFetch(`/super-admin/tenants/${tenantId}/${action}`, {
        method: "POST",
      });
      if (res.ok) await load(page);
    } finally {
      setActionLoading(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageLabel = loading ? "—" : `${tenants.length} / ${total}`;

  return (
    <div className="fade-up flex flex-col min-h-full">
      <Header
        title="Super Admin"
        subtitle={loading ? "Carregando plataforma…" : `${total} tenants na plataforma`}
      />

      <div className="dashboard-page space-y-5">
        <section className="super-admin-hero">
          <div className="relative z-10 space-y-2">
            <span className="super-admin-badge">
              <Shield className="w-3 h-3" aria-hidden />
              Controle da plataforma
            </span>
            <p className="dashboard-greeting-title">Gestão de Tenants</p>
            <p className="dashboard-greeting-sub max-w-xl">
              Visão global de clientes, limites de conversa e status operacional.
              Ações de suspensão afetam o acesso imediato ao WhatsApp e ao painel.
            </p>
          </div>
          {!loading && total > 0 && (
            <div className="relative z-10 text-right hidden sm:block">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                Taxa de ativação
              </p>
              <p className="text-2xl font-bold text-white tabular-nums">
                {kpis.total_tenants > 0
                  ? Math.round((kpis.active_tenants / kpis.total_tenants) * 100)
                  : 0}
                %
              </p>
            </div>
          )}
        </section>

        <div className="super-admin-kpi-grid">
          {KPI_CONFIG.map((card) => {
            const raw = kpis[card.key];
            const value =
              card.key === "total_conversations"
                ? raw.toLocaleString("pt-BR")
                : String(raw);
            return (
              <KpiCard
                key={card.key}
                title={card.label}
                value={value}
                icon={card.icon}
                iconColor={card.iconColor}
                accent={card.accent}
                loading={loading}
                empty={!loading && raw === 0}
              />
            );
          })}
          <KpiCard
            title="Nesta Página"
            value={pageLabel}
            icon={Building2}
            iconColor="text-violet-400"
            accent="#8b5cf6"
            loading={loading}
          />
        </div>

        <div className="super-admin-table-wrap">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--c-border)]">
            <div>
              <h3 className="text-sm font-semibold text-white">Todos os Tenants</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Ordenados por data de criação (mais recentes primeiro)
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="super-admin-table-head">
                  {["Tenant", "Plano", "WhatsApp", "Conversas / Limite", "Status", "Ações"].map(
                    (h) => (
                      <th key={h}>{h}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton />
                ) : tenants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">Nenhum tenant cadastrado</p>
                    </td>
                  </tr>
                ) : (
                  tenants.map((t) => {
                    const msgs = t.billing?.conversationsThisMonth ?? 0;
                    const limit = t.billing?.conversationsLimit ?? 0;
                    const pct = limit > 0 ? Math.min(100, (msgs / limit) * 100) : 0;
                    const busy = actionLoading === t.id;
                    const barColor = usageBarColor(pct);

                    return (
                      <tr key={t.id} className="super-admin-table-row">
                        <td>
                          <p className="font-medium text-white">{t.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {t.slug}.whatsagent.com.br
                          </p>
                          <p className="text-[10px] text-slate-600 mt-1">
                            {t._count.conversations.toLocaleString("pt-BR")} conversas totais
                          </p>
                        </td>
                        <td>
                          <span className="text-[11px] px-2.5 py-1 bg-indigo-500/10 text-indigo-300 rounded-full border border-indigo-500/20 font-medium">
                            {t.planType}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                              t.whatsappStatus === "CONNECTED"
                                ? "text-green-400"
                                : "text-slate-500"
                            }`}
                          >
                            {t.whatsappStatus === "CONNECTED" ? (
                              <CheckCircle className="w-3.5 h-3.5" aria-hidden />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" aria-hidden />
                            )}
                            {t.whatsappStatus === "CONNECTED" ? "Conectado" : "Desconectado"}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-slate-300 tabular-nums">
                            {msgs.toLocaleString("pt-BR")} / {limit.toLocaleString("pt-BR")}
                          </span>
                          <div className="super-admin-usage-track" title={`${Math.round(pct)}% do limite`}>
                            <div
                              className="super-admin-usage-fill"
                              style={{ width: `${pct}%`, background: barColor }}
                            />
                          </div>
                        </td>
                        <td>
                          <StatusBadge status={t.status} />
                        </td>
                        <td>
                          {t.status !== "SUSPENDED" && t.status !== "CANCELLED" ? (
                            <button
                              type="button"
                              onClick={() =>
                                setPending({
                                  tenantId: t.id,
                                  action: "suspend",
                                  tenantName: t.name,
                                })
                              }
                              disabled={busy}
                              aria-label={`Suspender ${t.name}`}
                              className="super-admin-action-btn super-admin-action-suspend"
                            >
                              <Ban className="w-3.5 h-3.5" aria-hidden />
                              Suspender
                            </button>
                          ) : t.status === "SUSPENDED" ? (
                            <button
                              type="button"
                              onClick={() =>
                                setPending({
                                  tenantId: t.id,
                                  action: "activate",
                                  tenantName: t.name,
                                })
                              }
                              disabled={busy}
                              aria-label={`Reativar ${t.name}`}
                              className="super-admin-action-btn super-admin-action-activate"
                            >
                              <RotateCcw className="w-3.5 h-3.5" aria-hidden />
                              Reativar
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="super-admin-pagination">
              <span className="text-xs text-slate-500">
                Página {page} de {totalPages} · {total} tenants
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1 || loading}
                  aria-label="Página anterior"
                  className="super-admin-page-btn"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages || loading}
                  aria-label="Próxima página"
                  className="super-admin-page-btn"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {pending && (
        <div
          className="super-admin-confirm-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div className="super-admin-confirm-dialog">
            <h2 id="confirm-title" className="text-base font-semibold text-white">
              {pending.action === "suspend" ? "Suspender tenant" : "Reativar tenant"}
            </h2>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              {pending.action === "suspend" ? (
                <>
                  O tenant <strong className="text-slate-200">{pending.tenantName}</strong>{" "}
                  perderá acesso ao painel e ao envio via WhatsApp até ser reativado.
                </>
              ) : (
                <>
                  O tenant <strong className="text-slate-200">{pending.tenantName}</strong>{" "}
                  voltará ao status ativo e poderá operar normalmente.
                </>
              )}
            </p>
            <div className="flex gap-2 mt-5 justify-end">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg border border-[var(--c-border)] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmAction()}
                className={`px-3 py-2 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                  pending.action === "suspend"
                    ? "bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
                    : "bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30"
                }`}
              >
                {pending.action === "suspend" ? "Confirmar suspensão" : "Confirmar reativação"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
