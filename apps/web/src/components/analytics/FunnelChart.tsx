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

const EMPTY_FUNNEL: FunnelData = {
  conversations: 0,
  catalog_viewed: 0,
  cart_started: 0,
  payment_generated: 0,
  payment_confirmed: 0,
};

export function FunnelChart({ data }: { data: FunnelData | null }) {
  return <ConversionFunnel data={data ?? EMPTY_FUNNEL} />;
}

export function ConversionFunnel({ data }: { data: FunnelData }) {
  const isEmpty = data.conversations === 0;
  const max = data.conversations || 1;
  const finalRate = isEmpty ? 0 : Math.round((data.payment_confirmed / data.conversations) * 100);

  return (
    <div className="analytics-panel overview-insight-panel">
      <div className="analytics-panel-header">
        <div className="analytics-panel-header-start">
          <div
            className="analytics-panel-icon"
            style={{ background: "rgba(99,102,241,0.12)", borderColor: "rgba(99,102,241,0.25)" }}
          >
            <TrendingDown className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.8} />
          </div>
          <div className="analytics-panel-header-text">
            <p className="text-[13px] font-semibold text-[#0f172a]">Funil de Conversão</p>
            <p className="text-[11px] text-[#475569] mt-0.5">Conversas → pagamentos confirmados</p>
          </div>
        </div>
        {!isEmpty && (
          <span className={`tag ${finalRate > 0 ? "tag-green" : "tag-slate"}`}>
            {finalRate}% taxa final
          </span>
        )}
      </div>

      {isEmpty ? (
        <div className="analytics-empty-inner">
          <div className="overview-insight-empty-icon">
            <TrendingDown className="w-5 h-5 text-indigo-400/40" strokeWidth={1.5} />
          </div>
          <p className="text-[13px] font-medium text-[#64748b]">Funil aguardando dados</p>
          <p className="text-[11px] text-[#475569] max-w-[220px] text-center leading-relaxed">
            Conversas e conversões aparecerão após as primeiras interações
          </p>
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
                <div className="analytics-funnel-row-head">
                  <div className="analytics-funnel-row-label">
                    <span className="analytics-funnel-row-num" style={{ color: s.color }}>
                      {s.num}
                    </span>
                    <span className="analytics-funnel-row-name">{s.label}</span>
                  </div>

                  <div className="analytics-funnel-row-values">
                    {i > 0 && drop > 0 && (
                      <span className="analytics-funnel-row-drop">
                        <ChevronDown className="w-3 h-3" strokeWidth={2.5} />
                        −{drop}%
                      </span>
                    )}
                    <span className="analytics-funnel-row-count">
                      {value.toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>

                <div className="analytics-funnel-track">
                  {pct > 0 ? (
                    <div
                      className="analytics-funnel-fill"
                      style={{
                        width: `${Math.max(pct, 8)}%`,
                        background: `linear-gradient(90deg, ${s.color}55, ${s.color}18)`,
                        borderColor: s.color,
                      }}
                    >
                      <span className="analytics-funnel-fill-pct" style={{ color: s.color }}>
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
