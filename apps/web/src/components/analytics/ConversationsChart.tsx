"use client";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { BarChart3, ChevronRight } from "lucide-react";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#0c1526", border:"1px solid #1a2d47", borderRadius:8, padding:"10px 12px", minWidth:140, fontSize:12 }}>
      <p style={{ color:"#64748b", marginBottom:8, fontWeight:500 }}>{label}</p>
      {payload.map((e: any) => (
        <div key={e.dataKey} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, marginBottom:4 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:e.color, flexShrink:0 }} />
            <span style={{ color:"#94a3b8" }}>{e.name}</span>
          </div>
          <span style={{ color:"#f1f5f9", fontWeight:600, fontVariantNumeric:"tabular-nums" }}>{e.value}</span>
        </div>
      ))}
    </div>
  );
};

const SERIES = [
  { key: "total",       name: "Total",       color: "#6366f1" },
  { key: "ai_resolved", name: "IA",          color: "#22c55e" },
  { key: "handoffs",    name: "Transferido", color: "#f59e0b" },
];

function ChartEmptyGhost() {
  return (
    <svg className="chart-empty-ghost" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="ghostFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 90 Q50 70 100 75 T200 45 T300 55 T400 30 V120 H0 Z"
        fill="url(#ghostFill)"
      />
      <path
        d="M0 90 Q50 70 100 75 T200 45 T300 55 T400 30"
        fill="none"
        stroke="#6366f1"
        strokeWidth="2"
        strokeOpacity="0.4"
      />
      <path
        d="M0 95 Q80 80 160 82 T320 65 T400 50"
        fill="none"
        stroke="#22c55e"
        strokeWidth="1.5"
        strokeOpacity="0.25"
        strokeDasharray="4 4"
      />
    </svg>
  );
}

export function ConversationsChart({
  data,
  days = 30,
  onDaysChange,
  whatsappConnected,
}: {
  data: any[];
  days?: number;
  onDaysChange?: (d: number) => void;
  whatsappConnected?: boolean;
}) {
  const empty = !data || data.length === 0;

  return (
    <div className="chart-panel">
      <div className="chart-panel-header">
        <div className="analytics-panel-header-start">
          <div
            className="analytics-panel-icon"
            style={{ background: "rgba(99,102,241,0.12)", borderColor: "rgba(99,102,241,0.25)" }}
          >
            <BarChart3 className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.8} />
          </div>
          <div className="analytics-panel-header-text">
            <p className="text-[13px] font-semibold text-[#e2e8f0] leading-none">Conversas</p>
            <p className="text-[11px] text-[#64748b] mt-1">Volume e resolução por IA</p>
          </div>
        </div>

        <div className="chart-panel-toolbar">
          <div className="analytics-period-pills" role="group" aria-label="Período do gráfico">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onDaysChange?.(d)}
                aria-pressed={days === d}
                className={`analytics-period-pill ${days === d ? "analytics-period-pill-active" : ""}`}
              >
                {d}d
              </button>
            ))}
          </div>

          <div className="chart-series-legend" aria-hidden="true">
            {SERIES.map((s) => (
              <div key={s.key} className="chart-series-legend-item">
                <span className="chart-series-dot" style={{ background: s.color }} />
                <span className="chart-series-label">{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="chart-panel-body">
      {empty ? (
        <div className="chart-empty">
          <ChartEmptyGhost />
          <div className="chart-empty-icon">
            <BarChart3 className="w-5 h-5 text-[#475569]" />
          </div>
          <div className="text-center relative z-10">
            <p className="text-[13px] font-medium text-[#94a3b8]">Nenhuma conversa ainda</p>
            <p className="text-[11px] text-[#475569] mt-1">Conecte seu WhatsApp para começar</p>
          </div>
          <Link
            href={whatsappConnected ? "/agent" : "/settings?tab=integracoes"}
            className="dashboard-agent-link relative z-10"
          >
            {whatsappConnected ? "Testar agente" : "Configurar WhatsApp"}
            <ChevronRight className="w-3 h-3" strokeWidth={1.8} />
          </Link>
        </div>
      ) : (
        <div className="chart-panel-canvas">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top:4, right:4, left:-24, bottom:0 }}>
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.key} id={`g_${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={s.color} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#111e32" vertical={false} />
            <XAxis dataKey="date" tick={{ fill:"#334155", fontSize:10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fill:"#334155", fontSize:10 }} tickLine={false} axisLine={false} width={28} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke:"#1a2d47", strokeWidth:1 }} />
            {SERIES.map((s) => {
              const dashed = s.key === "handoffs";

              return (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={dashed ? 1.5 : 2}
                  {...(dashed && { strokeDasharray: "5 4" })}
                  fill={`url(#g_${s.key})`}
                  dot={false}
                  activeDot={{ r:3, strokeWidth:0, fill:s.color }}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
        </div>
      )}
      </div>
    </div>
  );
}
