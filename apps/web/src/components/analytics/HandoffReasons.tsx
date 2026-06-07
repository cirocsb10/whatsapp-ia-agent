"use client";
import { PhoneForwarded } from "lucide-react";

const REASON_META: Record<string, { label: string; color: string }> = {
  KEYWORD_TRIGGER:       { label: "Palavra-chave detectada",  color: "#6366f1" },
  LOW_CONFIDENCE:        { label: "Baixa confiança da IA",    color: "#8b5cf6" },
  CUSTOMER_REQUEST:      { label: "Cliente solicitou",         color: "#06b6d4" },
  ORDER_VALUE_THRESHOLD: { label: "Alto valor de pedido",      color: "#f59e0b" },
  MANUAL:                { label: "Transferência manual",      color: "#94a3b8" },
  TIMEOUT:               { label: "Timeout de resposta",       color: "#64748b" },
  GUARD_RAIL:            { label: "Guard rail acionado",       color: "#ef4444" },
};

function reasonMeta(key: string) {
  return REASON_META[key] ?? {
    label: key.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
    color: "#64748b",
  };
}

export function HandoffReasons({ data }: { data?: Record<string, number> | null }) {
  const entries = data
    ? Object.entries(data).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a)
    : [];
  const isEmpty = entries.length === 0;
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  return (
    <div className="analytics-panel overview-insight-panel">
      <div className="analytics-panel-header">
        <div className="analytics-panel-header-start">
          <div
            className="analytics-panel-icon"
            style={{ background: "rgba(251,191,36,0.12)", borderColor: "rgba(251,191,36,0.25)" }}
          >
            <PhoneForwarded className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.8} />
          </div>
          <div className="analytics-panel-header-text">
            <p className="text-[13px] font-semibold text-[#e2e8f0]">Motivos de Handoff</p>
            <p className="text-[11px] text-[#475569] mt-0.5">Por que o agente transfere para humano</p>
          </div>
        </div>
        {!isEmpty && (
          <span className="tag tag-amber">{total} total</span>
        )}
      </div>

      {isEmpty ? (
        <div className="analytics-empty-inner">
          <div className="overview-insight-empty-icon">
            <PhoneForwarded className="w-5 h-5 text-amber-400/40" strokeWidth={1.5} />
          </div>
          <p className="text-[13px] font-medium text-[#94a3b8]">Nenhum handoff registrado</p>
          <p className="text-[11px] text-[#475569] max-w-[220px] text-center leading-relaxed">
            Transferências aparecerão aqui quando o agente escalar para humano
          </p>
        </div>
      ) : (
        <div className="analytics-reasons-list">
          {entries.map(([key, v]) => {
            const { label, color } = reasonMeta(key);
            const pct = total > 0 ? Math.round((v / total) * 100) : 0;
            return (
              <div key={key} className="analytics-reason-row">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: color, boxShadow: `0 0 5px ${color}70` }}
                  />
                  <span className="text-[11px] text-[#94a3b8] flex-1 min-w-0 truncate">{label}</span>
                  <span className="text-[12px] font-semibold text-[#cbd5e1] tabular-nums w-6 text-right flex-shrink-0">
                    {v}
                  </span>
                  <span className="text-[#334155] flex-shrink-0">·</span>
                  <span
                    className="text-[11px] font-semibold tabular-nums w-7 text-right flex-shrink-0"
                    style={{ color }}
                  >
                    {pct}%
                  </span>
                </div>
                <div className="analytics-prog-track">
                  <div
                    className="analytics-prog-fill"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${color}, ${color}70)`,
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
