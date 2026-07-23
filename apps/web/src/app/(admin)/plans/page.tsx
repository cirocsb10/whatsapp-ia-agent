"use client";

import { Header } from "@/components/layout/Header";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Shield,
} from "lucide-react";
import { ApiError } from "@/shared/api/fetcher";
import {
  useOverridePlan,
  usePlansOverview,
  type PlanTenantRow,
  type PlanType,
} from "@/features/admin/api/plans";

const PAGE_SIZE = 25;
const PLAN_OPTIONS: PlanType[] = ["STARTER", "GROWTH", "SCALE", "ENTERPRISE"];

function usageBarColor(pct: number): string {
  if (pct >= 90) return "#ef4444";
  if (pct >= 70) return "#f59e0b";
  return "#22c55e";
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "bg-green-500/10 text-green-600 border-green-500/25",
    TRIAL: "bg-amber-500/10 text-amber-700 border-amber-500/25",
    SUSPENDED: "bg-red-500/10 text-red-600 border-red-500/25",
    CANCELLED: "bg-slate-100 text-slate-500 border-slate-300",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${styles[status] ?? styles.SUSPENDED}`}
    >
      {status}
    </span>
  );
}

export default function PlansPage() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<PlanTenantRow | null>(null);
  const [nextPlan, setNextPlan] = useState<PlanType>("STARTER");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const query = usePlansOverview(page, PAGE_SIZE);
  const overridePlan = useOverridePlan();

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (selected) {
      setNextPlan(selected.planType);
      setReason("");
      setFeedback(null);
    }
  }, [selected]);

  async function handleOverride() {
    if (!selected) return;
    setFeedback(null);
    try {
      const result = await overridePlan.mutateAsync({
        tenantId: selected.id,
        planType: nextPlan,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      setFeedback({
        type: "success",
        message: `${result.warning} Plano: ${result.previousPlan} → ${result.planType}.`,
      });
      setSelected(null);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message || "Não foi possível alterar o plano."
          : "Erro de rede ao alterar o plano.";
      setFeedback({ type: "error", message });
    }
  }

  return (
    <div className="fade-up flex flex-col min-h-full">
      <Header
        title="Planos"
        subtitle="Visão de planos contratados e override manual"
      />

      <div className="dashboard-page space-y-5">
        <section className="super-admin-hero">
          <div className="relative z-10 space-y-2">
            <span className="super-admin-badge">
              <Shield className="w-3 h-3" aria-hidden />
              Controle da plataforma
            </span>
            <p className="dashboard-greeting-title">Planos dos tenants</p>
            <p className="dashboard-greeting-sub max-w-xl">
              Override manual altera apenas o plano interno. A assinatura Stripe
              permanece intacta.
            </p>
          </div>
          <div className="relative z-10 hidden sm:flex items-center gap-2 text-slate-500">
            <CreditCard className="w-8 h-8 opacity-40" aria-hidden />
          </div>
        </section>

        {feedback && (
          <p
            className={`text-[13px] px-1 ${
              feedback.type === "success" ? "text-green-600" : "text-rose-600"
            }`}
          >
            {feedback.message}
          </p>
        )}

        <div className="super-admin-table-wrap overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="super-admin-table-head">
                <th>Tenant</th>
                <th>Status</th>
                <th>Plano</th>
                <th>Uso</th>
                <th>Stripe</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {query.isLoading && (
                <tr className="super-admin-table-row">
                  <td colSpan={6}>
                    <div className="shimmer h-8 w-full rounded" />
                  </td>
                </tr>
              )}
              {!query.isLoading && items.length === 0 && (
                <tr className="super-admin-table-row">
                  <td colSpan={6} className="text-sm text-slate-500 text-center py-8">
                    Nenhum tenant encontrado.
                  </td>
                </tr>
              )}
              {items.map((tenant) => {
                const used = tenant.usage.conversationsThisMonth;
                const limit = tenant.usage.conversationsLimit;
                const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
                return (
                  <tr key={tenant.id} className="super-admin-table-row">
                    <td>
                      <p className="text-sm font-semibold text-slate-900">{tenant.name}</p>
                      <p className="text-[11px] text-slate-500">{tenant.slug}</p>
                    </td>
                    <td>
                      <StatusBadge status={tenant.status} />
                    </td>
                    <td>
                      <span className="text-[12px] font-semibold text-indigo-600">
                        {tenant.planType}
                      </span>
                    </td>
                    <td>
                      <p className="text-[12px] text-slate-700 tabular-nums">
                        {used} / {limit}
                      </p>
                      <div className="super-admin-usage-track">
                        <div
                          className="super-admin-usage-fill"
                          style={{ width: `${pct}%`, background: usageBarColor(pct) }}
                        />
                      </div>
                    </td>
                    <td>
                      <span
                        className={`text-[11px] font-medium ${
                          tenant.hasStripeSubscription ? "text-green-600" : "text-slate-400"
                        }`}
                      >
                        {tenant.hasStripeSubscription ? "Assinatura ativa" : "Sem Stripe"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="super-admin-action-btn super-admin-action-activate"
                        onClick={() => setSelected(tenant)}
                      >
                        Override
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="super-admin-pagination">
            <p className="text-[12px] text-slate-500">
              {total} tenant{total === 1 ? "" : "s"} · página {page} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="super-admin-page-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden />
              </button>
              <button
                type="button"
                className="super-admin-page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Próxima página"
              >
                <ChevronRight className="w-4 h-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <div className="super-admin-confirm-backdrop" role="presentation" onClick={() => setSelected(null)}>
          <div
            className="super-admin-confirm-dialog space-y-4"
            role="dialog"
            aria-modal="true"
            aria-label="Override de plano"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Alterar plano de {selected.name}
                </p>
                <p className="text-[12px] text-slate-500 mt-1">
                  A assinatura Stripe <strong>não</strong> será alterada. Isso só
                  muda o plano interno e o limite de conversas.
                </p>
              </div>
            </div>

            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-slate-900">Novo plano</span>
              <select
                className="settings-input"
                value={nextPlan}
                onChange={(e) => setNextPlan(e.target.value as PlanType)}
              >
                {PLAN_OPTIONS.map((plan) => (
                  <option key={plan} value={plan}>
                    {plan}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-slate-900">
                Motivo (opcional)
              </span>
              <input
                className="settings-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex.: cortesia comercial"
              />
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                className="super-admin-action-btn"
                onClick={() => setSelected(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="super-admin-action-btn super-admin-action-activate"
                disabled={overridePlan.isPending || nextPlan === selected.planType}
                onClick={() => void handleOverride()}
              >
                <CheckCircle className="w-3.5 h-3.5" aria-hidden />
                {overridePlan.isPending ? "Salvando…" : "Confirmar override"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
