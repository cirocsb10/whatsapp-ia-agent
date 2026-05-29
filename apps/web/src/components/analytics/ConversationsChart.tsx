"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const TooltipContent = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return <div className="bg-[#0F172A] border border-[#334155] rounded-lg p-3 shadow-xl text-sm"><p className="text-slate-400 mb-2 text-xs">{label}</p>{payload.map((e: any) => <div key={e.dataKey} className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full" style={{ background: e.color }} /><span className="text-slate-300">{e.name}:</span><span className="text-white font-semibold">{e.value}</span></div>)}</div>;
};

export function ConversationsChart({ data }: { data: any[] }) {
  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold text-white mb-1">Conversas (30 dias)</h3>
      <p className="text-xs text-slate-500 mb-4">Volume total e resolução por IA</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip content={<TooltipContent />} />
          <Line type="monotone" dataKey="total" name="Total" stroke="#6366F1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="ai_resolved" name="Resolvidos por IA" stroke="#22C55E" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="handoffs" name="Transferências" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
