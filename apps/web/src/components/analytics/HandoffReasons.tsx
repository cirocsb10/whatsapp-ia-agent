"use client";
import { PhoneForwarded } from "lucide-react";

const REASONS = [
  { key: "KEYWORD_TRIGGER",        label: "Palavra-chave detectada",  color: "#6366f1" },
  { key: "LOW_CONFIDENCE",         label: "Baixa confiança da IA",    color: "#8b5cf6" },
  { key: "CUSTOMER_REQUEST",       label: "Cliente solicitou",         color: "#06b6d4" },
  { key: "ORDER_VALUE_THRESHOLD",  label: "Alto valor de pedido",      color: "#f59e0b" },
];

export function HandoffReasons({ data }: { data?: Record<string, number> }) {
  const isEmpty = !data || Object.values(data).every((v) => v === 0);
  const total = data ? Object.values(data).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="analytics-panel">
      <div className="analytics-panel-header">
        <div className="flex items-center gap-2.5">
          <div className="analytics-panel-icon" style={{ background: "rgba(251,191,36,0.12)", borderColor: "rgba(251,191,36,0.25)" }}>
            <PhoneForwarded className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#e2e8f0]">Motivos de Handoff</p>
            <p className="text-[11px] text-[#475569] mt-0.5">Por que a IA transferiu</p>
          </div>
        </div>
        {!isEmpty && (
          <span className="tag tag-amber">{total} total</span>
        )}
      </div>

      {isEmpty ? (
        <div className="analytics-empty-inner">
          <PhoneForwarded className="w-5 h-5 text-slate-700" strokeWidth={1.5} />
          <p className="text-[12px] text-[#475569]">Sem handoffs no período</p>
        </div>
      ) : (
        <div className="analytics-reasons-list">
          {REASONS.map(({ key, label, color }) => {
            const v = data?.[key] ?? 0;
            const pct = total > 0 ? Math.round((v / total) * 100) : 0;
            return (
              <div key={key} className="analytics-reason-row">
                {/* Label + values */}
                <div className="flex items-center gap-2 mb-2">
                  {/* Dot */}
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: color, boxShadow: `0 0 5px ${color}70` }}
                  />
                  {/* Label — fills remaining space */}
                  <span className="text-[11px] text-[#94a3b8] flex-1 min-w-0 truncate">{label}</span>
                  {/* Count — fixed width */}
                  <span className="text-[12px] font-semibold text-[#cbd5e1] tabular-nums w-6 text-right flex-shrink-0">
                    {v}
                  </span>
                  {/* Divider */}
                  <span className="text-[#334155] flex-shrink-0">·</span>
                  {/* Percentage — fixed width */}
                  <span
                    className="text-[11px] font-semibold tabular-nums w-7 text-right flex-shrink-0"
                    style={{ color: v > 0 ? color : "#334155" }}
                  >
                    {pct}%
                  </span>
                </div>
                {/* Progress bar */}
                <div className="analytics-prog-track">
                  <div
                    className="analytics-prog-fill"
                    style={{
                      width: `${pct}%`,
                      background: pct > 0
                        ? `linear-gradient(90deg, ${color}, ${color}70)`
                        : "transparent",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
