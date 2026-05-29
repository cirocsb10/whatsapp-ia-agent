"use client";
export function ConversionFunnel({ data }: { data: { conversations: number; catalog_viewed: number; cart_started: number; payment_generated: number; payment_confirmed: number } }) {
  const stages = [
    { name: "Conversas Iniciadas", value: data.conversations, fill: "#6366F1" },
    { name: "Catálogo Consultado", value: data.catalog_viewed, fill: "#8B5CF6" },
    { name: "Carrinho Adicionado", value: data.cart_started, fill: "#EC4899" },
    { name: "Pagamento Gerado", value: data.payment_generated, fill: "#F59E0B" },
    { name: "Pagamento Confirmado", value: data.payment_confirmed, fill: "#22C55E" },
  ];
  const max = stages[0]?.value ?? 1;
  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold text-white mb-1">Funil de Conversão</h3>
      <p className="text-xs text-slate-500 mb-4">Jornada do contato à compra confirmada</p>
      <div className="space-y-2">
        {stages.map((s, i) => {
          const pct = Math.round((s.value / max) * 100);
          const drop = i > 0 ? Math.round(((stages[i-1]!.value - s.value) / stages[i-1]!.value) * 100) : 0;
          return (
            <div key={s.name}>
              <div className="flex items-center justify-between mb-1"><span className="text-xs text-slate-400">{s.name}</span><div className="flex items-center gap-2">{i > 0 && drop > 0 && <span className="text-[10px] text-red-400">-{drop}%</span>}<span className="text-xs font-semibold text-white">{s.value.toLocaleString("pt-BR")}</span></div></div>
              <div className="h-7 bg-[#0F172A] rounded-lg overflow-hidden"><div className="h-full rounded-lg flex items-center px-3" style={{ width: `${pct}%`, backgroundColor: s.fill + "33", borderLeft: `2px solid ${s.fill}` }}><span className="text-[10px] font-bold" style={{ color: s.fill }}>{pct}%</span></div></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
