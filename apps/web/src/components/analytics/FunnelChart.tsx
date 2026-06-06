"use client";
import { TrendingDown, ChevronDown } from "lucide-react";

interface FunnelData {
  conversations: number;
  catalog_viewed: number;
  cart_started: number;
  payment_generated: number;
  payment_confirmed: number;
}

const STAGES = [
  { key: "conversations"      as const, label: "Conversas Iniciadas",  color: "#6366f1", num: "01" },
  { key: "catalog_viewed"     as const, label: "Catálogo Consultado",  color: "#8b5cf6", num: "02" },
  { key: "cart_started"       as const, label: "Carrinho Adicionado",  color: "#ec4899", num: "03" },
  { key: "payment_generated"  as const, label: "Pagamento Gerado",     color: "#f59e0b", num: "04" },
  { key: "payment_confirmed"  as const, label: "Pagamento Confirmado", color: "#22c55e", num: "05" },
];

export function ConversionFunnel({ data }: { data: FunnelData }) {
  const isEmpty = data.conversations === 0;
  const max = data.conversations || 1;

  return (
    <div className="analytics-panel">
      <div className="analytics-panel-header">
        <div className="flex items-center gap-2.5">
          <div className="analytics-panel-icon" style={{ background: "rgba(99,102,241,0.12)", borderColor: "rgba(99,102,241,0.25)" }}>
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
                {/* Label row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="text-[9px] font-mono font-bold flex-shrink-0"
                      style={{ color: s.color, opacity: 0.6 }}
                    >
                      {s.num}
                    </span>
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: s.color, boxShadow: `0 0 5px ${s.color}80` }}
                    />
                    <span className="text-[11px] font-medium text-[#94a3b8] truncate">{s.label}</span>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0 ml-3">
                    {i > 0 && drop > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-red-400/70 tabular-nums font-medium">
                        <ChevronDown className="w-3 h-3" strokeWidth={2.5} />
                        {drop}%
                      </span>
                    )}
                    <span className="text-[13px] font-semibold text-[#e2e8f0] tabular-nums w-8 text-right">
                      {value.toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>

                {/* Bar track */}
                <div className="analytics-funnel-track">
                  {pct > 0 ? (
                    <div
                      className="analytics-funnel-fill"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${s.color}50, ${s.color}16)`,
                        borderColor: s.color,
                      }}
                    >
                      <span className="text-[10px] font-bold px-2" style={{ color: s.color }}>
                        {pct}%
                      </span>
                    </div>
                  ) : (
                    <div className="analytics-funnel-fill-zero" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
