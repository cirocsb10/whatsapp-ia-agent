"use client";
import { Activity } from "lucide-react";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const PEAK_HOURS = [9, 12, 15, 18, 21];

function cellColor(v: number, max: number): string {
  if (!v) return "rgba(15,23,42,0.6)";
  const p = v / max;
  if (p < 0.15) return "rgba(99,102,241,0.15)";
  if (p < 0.35) return "rgba(99,102,241,0.3)";
  if (p < 0.55) return "rgba(99,102,241,0.5)";
  if (p < 0.75) return "rgba(99,102,241,0.7)";
  return "rgba(99,102,241,0.92)";
}

export function ActivityHeatmap({ data }: { data: Array<{ hour: number; day: number; value: number }> }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const isEmpty = data.every((d) => d.value === 0);
  const grid: Record<string, number> = {};
  data.forEach(({ hour, day, value }) => { grid[`${day}-${hour}`] = value; });

  return (
    <div className="analytics-panel">
      {/* Header */}
      <div className="analytics-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="analytics-panel-icon" style={{ background: "rgba(6,182,212,0.1)", borderColor: "rgba(6,182,212,0.2)" }}>
            <Activity className="w-3.5 h-3.5 text-cyan-400" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#e2e8f0]">Heatmap de Atividade</p>
            <p className="text-[11px] text-[#475569] mt-0.5">Volume de mensagens por hora e dia da semana</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#475569]">Menos</span>
          {[0.1, 0.3, 0.5, 0.75, 1].map((p) => (
            <span
              key={p}
              className="w-3 h-3 rounded-sm"
              style={{ background: cellColor(p * max, max) }}
            />
          ))}
          <span className="text-[10px] text-[#475569]">Mais</span>
        </div>
      </div>

      {isEmpty ? (
        <div className="analytics-empty-inner" style={{ minHeight: 180 }}>
          <Activity className="w-5 h-5 text-slate-700" strokeWidth={1.5} />
          <p className="text-[12px] text-[#475569]">Sem atividade no período</p>
        </div>
      ) : (
        <div className="p-4 overflow-x-auto">
          <div style={{ minWidth: 600 }}>
            {/* Hour labels */}
            <div className="flex items-center gap-0.5 mb-1 pl-10">
              {HOURS.map((h) => (
                <div key={h} className="flex-1 text-center">
                  {PEAK_HOURS.includes(h) && (
                    <span className="text-[9px] text-[#334155] tabular-nums">{h}h</span>
                  )}
                </div>
              ))}
            </div>
            {/* Grid */}
            {DAYS.map((day, di) => (
              <div key={day} className="flex items-center gap-0.5 mb-0.5">
                <span className="text-[10px] text-[#334155] w-9 text-right pr-2 flex-shrink-0">{day}</span>
                <div className="flex flex-1 gap-0.5">
                  {HOURS.map((h) => {
                    const val = grid[`${di}-${h}`] ?? 0;
                    return (
                      <div
                        key={h}
                        className="flex-1 h-5 rounded-sm cursor-default transition-opacity hover:opacity-80"
                        style={{ background: cellColor(val, max) }}
                        title={`${day} ${h}h: ${val} msgs`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
