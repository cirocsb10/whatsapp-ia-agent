"use client";
const DAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
function intensity(v: number, max: number) { if (!v) return "bg-[#0F172A]"; const p = v/max; if (p < 0.2) return "bg-green-900/30"; if (p < 0.4) return "bg-green-800/50"; if (p < 0.6) return "bg-green-600/60"; if (p < 0.8) return "bg-green-500/70"; return "bg-green-400/90"; }

export function ActivityHeatmap({ data }: { data: Array<{ hour: number; day: number; value: number }> }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const grid: Record<string, number> = {};
  data.forEach(({ hour, day, value }) => { grid[`${day}-${hour}`] = value; });
  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold text-white mb-1">Heatmap de Atividade</h3>
      <p className="text-xs text-slate-500 mb-4">Volume de mensagens por hora e dia da semana</p>
      <div className="overflow-x-auto"><div className="min-w-[600px]">
        {DAYS.map((day, di) => (
          <div key={day} className="flex items-center gap-1 mb-1">
            <span className="text-[10px] text-slate-600 w-9 text-right">{day}</span>
            <div className="flex flex-1 gap-0.5">{HOURS.map((h) => <div key={h} className={`flex-1 h-5 rounded-sm ${intensity(grid[`${di}-${h}`] ?? 0, max)} cursor-default`} title={`${day} ${h}h: ${grid[`${di}-${h}`] ?? 0} msgs`} />)}</div>
          </div>
        ))}
      </div></div>
    </div>
  );
}
