"use client";
import { Activity } from "lucide-react";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const PEAK_HOURS = [6, 9, 12, 15, 18, 21];

function cellColor(v: number, max: number): string {
  if (!v) return "rgba(15,23,42,0.55)";
  const p = v / max;
  if (p < 0.15) return "rgba(99,102,241,0.2)";
  if (p < 0.35) return "rgba(99,102,241,0.38)";
  if (p < 0.55) return "rgba(99,102,241,0.56)";
  if (p < 0.75) return "rgba(99,102,241,0.74)";
  return "rgba(99,102,241,0.96)";
}

const LEGEND_STEPS = [0.08, 0.25, 0.45, 0.70, 1];

export function ActivityHeatmap({ data }: { data: Array<{ hour: number; day: number; value: number }> }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const isEmpty = data.every((d) => d.value === 0);
  const grid: Record<string, number> = {};
  data.forEach(({ hour, day, value }) => { grid[`${day}-${hour}`] = value; });

  return (
    <div className="analytics-panel">
      <div className="analytics-panel-header">
        <div className="flex items-center gap-2.5">
          <div className="analytics-panel-icon" style={{ background: "rgba(6,182,212,0.12)", borderColor: "rgba(6,182,212,0.25)" }}>
            <Activity className="w-3.5 h-3.5 text-cyan-400" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#e2e8f0]">Heatmap de Atividade</p>
            <p className="text-[11px] text-[#475569] mt-0.5">Volume de mensagens por hora e dia da semana</p>
          </div>
        </div>

        {/* Legend — using inline-block divs to avoid span collapse bug */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: "#475569" }}>Menos</span>
          {LEGEND_STEPS.map((p) => (
            <div
              key={p}
              style={{
                display: "inline-block",
                width: 14,
                height: 14,
                borderRadius: 3,
                flexShrink: 0,
                background: cellColor(p * max, max),
              }}
            />
          ))}
          <span style={{ fontSize: 10, color: "#475569" }}>Mais</span>
        </div>
      </div>

      {isEmpty ? (
        <div className="analytics-empty-inner" style={{ minHeight: 190 }}>
          <Activity className="w-5 h-5 text-slate-700" strokeWidth={1.5} />
          <p className="text-[12px] text-[#475569]">Sem atividade no período</p>
        </div>
      ) : (
        <div style={{ padding: "18px 20px 20px", overflowX: "auto" }}>
          <div style={{ minWidth: 580 }}>
            {/* Hour axis labels */}
            <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 6, paddingLeft: 38 }}>
              {HOURS.map((h) => (
                <div key={h} style={{ flex: 1, textAlign: "center" }}>
                  {PEAK_HOURS.includes(h) && (
                    <span style={{ fontSize: 9, color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                      {h}h
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Day rows */}
            {DAYS.map((day, di) => (
              <div key={day} style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 3 }}>
                <span style={{
                  fontSize: 10,
                  color: "#64748b",
                  width: 32,
                  textAlign: "right",
                  paddingRight: 6,
                  flexShrink: 0,
                  fontWeight: 500,
                }}>
                  {day}
                </span>
                <div style={{ display: "flex", flex: 1, gap: 2 }}>
                  {HOURS.map((h) => {
                    const val = grid[`${di}-${h}`] ?? 0;
                    return (
                      <div
                        key={h}
                        title={`${day} ${h}h — ${val} msgs`}
                        style={{
                          flex: 1,
                          height: 22,
                          borderRadius: 3,
                          cursor: "default",
                          background: cellColor(val, max),
                          transition: "opacity 150ms ease, transform 150ms ease",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.opacity = "0.7";
                          (e.currentTarget as HTMLElement).style.transform = "scale(1.15)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.opacity = "1";
                          (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                        }}
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
