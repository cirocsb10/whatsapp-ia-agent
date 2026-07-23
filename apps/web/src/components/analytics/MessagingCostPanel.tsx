"use client";

import { Wallet } from "lucide-react";
import type { MessagingCostData } from "@/features/analytics/api/queries";

const CATEGORY_LABELS: Record<string, string> = {
  marketing: "Marketing",
  utility: "Utility",
  authentication: "Authentication",
  service: "Service",
};

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function categoryLabel(key: string) {
  return CATEGORY_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export function MessagingCostPanel({
  data,
  loading,
}: {
  data?: MessagingCostData | null;
  loading?: boolean;
}) {
  const byCategory = data?.byCategory ?? [];
  const byChannel = data?.byChannel ?? [];
  const isEmpty = !loading && byCategory.length === 0 && byChannel.length === 0;

  return (
    <div className="analytics-panel overview-insight-panel">
      <div className="analytics-panel-header">
        <div className="analytics-panel-header-start">
          <div
            className="analytics-panel-icon"
            style={{ background: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.25)" }}
          >
            <Wallet className="w-3.5 h-3.5 text-green-400" strokeWidth={1.8} />
          </div>
          <div className="analytics-panel-header-text">
            <p className="text-[13px] font-semibold text-[#0f172a]">Uso e custos</p>
            <p className="text-[11px] text-[#475569] mt-0.5">
              Custo estimado de mensagens Meta por canal e categoria
            </p>
          </div>
        </div>
        <span className="tag tag-amber" title="Não é a fatura oficial da Meta">
          Estimativa
        </span>
      </div>

      {loading ? (
        <div className="analytics-empty-inner">
          <p className="text-[13px] text-[#64748b]">Carregando estimativa…</p>
        </div>
      ) : isEmpty ? (
        <div className="analytics-empty-inner">
          <div className="overview-insight-empty-icon">
            <Wallet className="w-5 h-5 text-green-400/40" strokeWidth={1.5} />
          </div>
          <p className="text-[13px] font-medium text-[#64748b]">Sem dados de pricing no período</p>
          <p className="text-[11px] text-[#475569] max-w-[240px] text-center leading-relaxed">
            Categorias Meta aparecem quando o webhook de status envia pricing.category
          </p>
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          <div className="flex items-baseline justify-between gap-3 px-0.5">
            <div>
              <p className="text-[11px] text-[#64748b]">Total estimado</p>
              <p className="text-[18px] font-semibold text-[#0f172a] tabular-nums">
                {formatBrl(data?.totalBrlCents ?? 0)}
              </p>
            </div>
            <p className="text-[11px] text-[#64748b] tabular-nums">
              {data?.totalMessages ?? 0} msgs outbound
            </p>
          </div>

          <div className="flex items-baseline justify-between gap-3 px-0.5 pt-1 border-t border-[#e2e8f0]/80">
            <div>
              <p className="text-[11px] text-[#64748b]">Projeção mensal (estimativa)</p>
              <p className="text-[15px] font-semibold text-[#0f172a] tabular-nums">
                {formatBrl(data?.projectedMonthlyBrlCents ?? 0)}
              </p>
            </div>
          </div>

          {byCategory.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-[#475569] mb-2">Por categoria</p>
              <ul className="space-y-1.5">
                {byCategory.map((row) => (
                  <li
                    key={row.category}
                    className="flex items-center justify-between gap-2 text-[12px]"
                  >
                    <span className="text-[#334155]">
                      {categoryLabel(row.category)}
                      <span className="text-[#94a3b8] ml-1.5">{row.messageCount}</span>
                    </span>
                    <span className="tabular-nums text-[#0f172a] font-medium">
                      {formatBrl(row.costBrlCents)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {byChannel.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-[#475569] mb-2">Por canal</p>
              <ul className="space-y-1.5">
                {byChannel.map((row) => (
                  <li
                    key={row.channelId ?? "none"}
                    className="flex items-center justify-between gap-2 text-[12px]"
                  >
                    <span className="text-[#334155] truncate">{row.channelLabel}</span>
                    <span className="tabular-nums text-[#0f172a] font-medium shrink-0">
                      {formatBrl(row.costBrlCents)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[10px] text-[#94a3b8] leading-relaxed">
            Valores com tarifas placeholder BR — não substituem a fatura Meta.
          </p>
        </div>
      )}
    </div>
  );
}
