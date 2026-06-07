"use client";

const REASON_LABELS: Record<string, string> = {
  KEYWORD_TRIGGER: "Palavra-chave",
  LOW_CONFIDENCE: "Baixa confiança IA",
  ORDER_VALUE_THRESHOLD: "Valor alto do pedido",
  TIMEOUT: "Timeout",
  CUSTOMER_REQUEST: "Pedido do cliente",
};

export function HandoffReasonsChart({ data }: { data: Record<string, number> | null }) {
  if (!data) return null;

  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  const maxVal = entries[0]?.[1] ?? 1;

  return (
    <div className="chart-panel">
      <div className="mb-4">
        <p className="text-[13px] font-semibold text-[#e2e8f0] leading-none">Motivos de Handoff</p>
        <p className="text-[11px] text-[#64748b] mt-1">Por que o agente transfere para humano</p>
      </div>

      {entries.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-[12px] text-[#475569]">
          Nenhum handoff registrado
        </div>
      ) : (
        <div className="space-y-2.5">
          {entries.map(([reason, count]) => (
            <div key={reason}>
              <div className="flex justify-between text-[11px] mb-1">
                <span style={{ color: "#94a3b8" }}>
                  {REASON_LABELS[reason] ?? reason}
                </span>
                <span style={{ color: "#e2e8f0", fontVariantNumeric: "tabular-nums" }}>{count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800">
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${Math.round((count / maxVal) * 100)}%`,
                    background: "#ef4444",
                    opacity: 0.6,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
