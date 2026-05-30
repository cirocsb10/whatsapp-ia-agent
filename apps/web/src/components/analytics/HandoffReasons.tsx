"use client";
import { PhoneCall } from "lucide-react";

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
      {/* Header */}
      <div className="analytics-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="analytics-panel-icon" style={{ background: "rgba(251,191,36,0.1)", borderColor: "rgba(251,191,36,0.2)" }}>
            <PhoneCall className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#e2e8f0]">Motivos de Handoff</p>
            <p className="text-[11px] text-[#475569] mt-0.5">Por que a IA transferiu</p>
          </div>
        </div>
        {!isEmpty && (
          <span className="tag tag-slate">{total} total</span>
        )}
      </div>

      {isEmpty ? (
        <div className="analytics-empty-inner">
          <PhoneCall className="w-5 h-5 text-slate-700" strokeWidth={1.5} />
          <p className="text-[12px] text-[#475569]">Sem handoffs no período</p>
        </div>
      ) : (
        <div className="analytics-reasons-list">
          {REASONS.map(({ key, label, color }) => {
            const v = data?.[key] ?? 0;
            const pct = total > 0 ? Math.round((v / total) * 100) : 0;
            return (
              <div key={key} className="analytics-reason-row">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-[12px] text-[#94a3b8]">{label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-[#e2e8f0] tabular-nums">{v}</span>
                    <span className="text-[10px] text-[#475569] tabular-nums w-8 text-right">{pct}%</span>
                  </div>
                </div>
                <div className="prog-track">
                  <div className="prog-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
