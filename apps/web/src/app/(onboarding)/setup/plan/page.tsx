"use client";
import { useRouter } from "next/navigation";
import { Check, ArrowRight } from "lucide-react";

const PLANS = [
  { id: "STARTER", name: "Starter", price: "R$ 197", features: ["500 conversas/mês","100 produtos","2 agentes humanos","Analytics básico"] },
  { id: "GROWTH", name: "Growth", price: "R$ 497", highlight: true, features: ["3.000 conversas/mês","1.000 produtos","5 agentes humanos","Analytics completo"] },
  { id: "SCALE", name: "Scale", price: "R$ 997", features: ["10.000 conversas/mês","Produtos ilimitados","15 agentes humanos","Analytics avançado + Export"] },
];

export default function PlanPage() {
  const router = useRouter();
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center"><h1 className="text-2xl font-bold text-white">Escolha seu plano</h1><p className="text-slate-500 mt-1.5 text-sm">14 dias grátis em qualquer plano. Cancele quando quiser.</p></div>
      <div className="space-y-3">
        {PLANS.map((p) => (
          <div key={p.id} className={`glass-card p-5 ${p.highlight ? "border-green-500/30 bg-green-500/5" : ""}`}>
            <div className="flex items-start justify-between mb-3"><div className="flex items-center gap-2"><h3 className="text-lg font-bold text-white">{p.name}</h3>{p.highlight && <span className="text-[10px] px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full border border-green-500/30">Recomendado</span>}</div><p className="text-2xl font-bold text-white">{p.price}<span className="text-sm text-slate-500 font-normal">/mês</span></p></div>
            <ul className="space-y-1.5 mb-4">{p.features.map((f) => <li key={f} className="flex items-center gap-2 text-xs text-slate-400"><Check className="w-3.5 h-3.5 text-green-400 shrink-0" />{f}</li>)}</ul>
            <button onClick={() => router.push("/overview")} className={`w-full h-10 rounded-xl font-medium text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors ${p.highlight ? "bg-green-500 hover:bg-green-400 text-white" : "bg-[#1E293B] hover:bg-[#334155] text-slate-300"}`}>Começar 14 dias grátis <ArrowRight className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
