"use client";
import { TrendingDown, ArrowRight } from "lucide-react";

interface FunnelData {
  conversations: number;
  catalog_viewed: number;
  cart_started: number;
  payment_generated: number;
  payment_confirmed: number;
}

const STAGES = [
  { key: "conversations"      as const, label: "Conversas Iniciadas",  color: "#6366f1" },
  { key: "catalog_viewed"     as const, label: "Catálogo Consultado",  color: "#8b5cf6" },
  { key: "cart_started"       as const, label: "Carrinho Adicionado",  color: "#ec4899" },
  { key: "payment_generated"  as const, label: "Pagamento Gerado",     color: "#f59e0b" },
  { key: "payment_confirmed"  as const, label: "Pagamento Confirmado", color: "#22c55e" },
];

export function ConversionFunnel({ data }: { data: FunnelData }) {
  const isEmpty = data.conversations === 0;
  const max = data.conversations || 1;

  return (
    <div className="analytics-panel">
      {/* Header */}
      <div className="analytics-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="analytics-panel-icon" style={{ background: "rgba(99,102,241,0.1)", borderColor: "rgba(99,102,241,0.2)" }}>
            <TrendingDown className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#e2e8f0]">Funil de Conversão</p>
            <p className="text-[11px] text-[#475569] mt-0.5">Jornada do contato à compra confirmada</p>
          </div>
        </div>
        {!isEmpty && (
          <span className="tag tag-green">
            {Math.round((data.payment_confirmed / data.conversations) * 100)}% taxa final
          </span>
        )}
      </div>

      {isEmpty ? (
        <div className="analytics-empty-inner">
          <TrendingDown className="w-5 h-5 text-slate-700" strokeWidth={1.5} />
          <p className="text-[12px] text-[#475569]">Sem conversas no período</p>
        </div>
      ) : (
        <div className="analytics-funnel-list">
          {STAGES.map((s, i) => {
            const value = data[s.key];
            const pct = Math.round((value / max) * 100);
            const prev = i > 0 ? data[STAGES[i - 1]!.key] : value;
            const drop = i > 0 && prev > 0 ? Math.round(((prev - value) / prev) * 100) : 0;

            return (
              <div key={s.key} className="analytics-funnel-row">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-[#94a3b8]">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {i > 0 && drop > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-red-400 tabular-nums">
                        <ArrowRight className="w-2.5 h-2.5 rotate-90" strokeWidth={2} />
                        -{drop}%
                      </span>
                    )}
                    <span className="text-[13px] font-semibold text-[#e2e8f0] tabular-nums">
                      {value.toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>
                <div className="analytics-funnel-track">
                  <div
                    className="analytics-funnel-fill"
                    style={{ width: `${pct}%`, background: `${s.color}22`, borderColor: s.color }}
                  >
                    <span className="text-[10px] font-bold px-2" style={{ color: s.color }}>
                      {pct}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
