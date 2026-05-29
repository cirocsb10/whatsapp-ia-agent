import { Header } from "@/components/layout/Header";
import { KpiCard } from "@/components/analytics/KpiCard";
import { ConversionFunnel } from "@/components/analytics/FunnelChart";
import { ActivityHeatmap } from "@/components/analytics/HeatmapChart";
import { Target, Users, ShoppingCart, DollarSign, Clock, Zap } from "lucide-react";

export default function AnalyticsPage() {
  const funnel = { conversations: 1248, catalog_viewed: 892, cart_started: 445, payment_generated: 203, payment_confirmed: 156 };
  const heatmap = Array.from({ length: 7*24 }, (_, i) => ({ day: Math.floor(i/24), hour: i%24, value: Math.random() > 0.3 ? Math.floor(Math.random() * 40) : 0 }));
  const convRate = Math.round((funnel.payment_confirmed / funnel.conversations) * 100);
  return (
    <div className="animate-fade-in">
      <Header title="Analytics" subtitle="Últimos 30 dias" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[{ title: "Conversas", value: funnel.conversations.toLocaleString("pt-BR"), icon: Users, iconColor: "text-indigo-400" }, { title: "Viram Catálogo", value: `${Math.round(funnel.catalog_viewed/funnel.conversations*100)}%`, icon: Target, iconColor: "text-violet-400" }, { title: "Adicionaram", value: `${Math.round(funnel.cart_started/funnel.conversations*100)}%`, icon: ShoppingCart, iconColor: "text-pink-400" }, { title: "Converteram", value: `${convRate}%`, icon: Zap, iconColor: "text-green-400" }, { title: "Pedidos", value: funnel.payment_confirmed, icon: DollarSign, iconColor: "text-yellow-400" }, { title: "Tempo Médio", value: "3m 42s", icon: Clock, iconColor: "text-cyan-400" }].map((k) => <KpiCard key={k.title} {...k} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><ConversionFunnel data={funnel} /><div className="glass-card p-5"><h3 className="text-sm font-semibold text-white mb-4">Motivos de Handoff</h3><div className="space-y-3">{[{ r: "KEYWORD_TRIGGER", l: "Palavra-chave detectada", v: 45 }, { r: "LOW_CONFIDENCE", l: "Baixa confiança", v: 28 }, { r: "CUSTOMER_REQUEST", l: "Cliente solicitou", v: 19 }, { r: "ORDER_VALUE_THRESHOLD", l: "Valor alto", v: 8 }].map(({ r, l, v }) => { const t = 100; const p = Math.round(v/t*100); return <div key={r}><div className="flex justify-between items-center mb-1"><span className="text-xs text-slate-400">{l}</span><span className="text-xs text-white font-medium">{v} ({p}%)</span></div><div className="h-1.5 bg-slate-800 rounded-full"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${p}%` }} /></div></div>; })}</div></div></div>
        <ActivityHeatmap data={heatmap} />
      </div>
    </div>
  );
}
