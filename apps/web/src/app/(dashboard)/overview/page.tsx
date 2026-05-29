import { Header } from "@/components/layout/Header";
import { KpiCard } from "@/components/analytics/KpiCard";
import { ConversationsChart } from "@/components/analytics/ConversationsChart";
import { MessageSquare, Zap, DollarSign, PhoneCall, Users, ShoppingCart, TrendingUp, Clock } from "lucide-react";

const kpis = { conversations_today: 147, ai_resolution_rate: 87, revenue_today: 428900, pending_handoffs: 3, avg_response_time_sec: 4, new_contacts_today: 31, orders_today: 18, conversion_rate: 12 };
const chartData = Array.from({ length: 30 }, (_, i) => ({ date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), total: Math.floor(Math.random() * 80) + 60, ai_resolved: Math.floor(Math.random() * 60) + 40, handoffs: Math.floor(Math.random() * 15) + 3 }));

export default function OverviewPage() {
  const cards = [
    { title: "Conversas Hoje", value: kpis.conversations_today, change: 12, trend: "up" as const, icon: MessageSquare, iconColor: "text-indigo-400", changeLabel: "vs. ontem" },
    { title: "Resolução por IA", value: `${kpis.ai_resolution_rate}%`, change: 3.2, trend: "up" as const, icon: Zap, iconColor: "text-green-400", changeLabel: "vs. semana passada" },
    { title: "Receita do Dia", value: `R$ ${(kpis.revenue_today / 100).toFixed(2).replace(".", ",")}`, change: -5.1, trend: "down" as const, icon: DollarSign, iconColor: "text-yellow-400", changeLabel: "vs. ontem" },
    { title: "Handoffs Pendentes", value: kpis.pending_handoffs, icon: PhoneCall, iconColor: kpis.pending_handoffs > 0 ? "text-red-400" : "text-slate-400" },
    { title: "Tempo Médio Resp.", value: `${kpis.avg_response_time_sec}s`, change: -18, trend: "up" as const, icon: Clock, iconColor: "text-cyan-400" },
    { title: "Novos Contatos", value: kpis.new_contacts_today, change: 8, trend: "up" as const, icon: Users, iconColor: "text-violet-400", changeLabel: "vs. ontem" },
    { title: "Pedidos Hoje", value: kpis.orders_today, change: 25, trend: "up" as const, icon: ShoppingCart, iconColor: "text-orange-400", changeLabel: "vs. ontem" },
    { title: "Taxa Conversão", value: `${kpis.conversion_rate}%`, change: 1.5, trend: "up" as const, icon: TrendingUp, iconColor: "text-emerald-400", changeLabel: "conversations → pedido" },
  ];
  return (
    <div className="animate-fade-in">
      <Header title="Overview" subtitle={new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} />
      <div className="p-6 space-y-6">
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Métricas de Hoje</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{cards.map((c) => <KpiCard key={c.title} {...c} />)}</div>
        </section>
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2"><ConversationsChart data={chartData} /></div>
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Status do Agente</h3>
            <div className="space-y-4">
              {[{ label: "Taxa Resolução IA", value: `${kpis.ai_resolution_rate}%`, color: "bg-green-500", width: `${kpis.ai_resolution_rate}%` }, { label: "Satisfação CSAT", value: "4.7/5", color: "bg-indigo-500", width: "94%" }, { label: "Precisão Catálogo", value: "96%", color: "bg-cyan-500", width: "96%" }, { label: "Uptime API", value: "99.9%", color: "bg-yellow-500", width: "99.9%" }].map(({ label, value, color, width }) => (
                <div key={label}>
                  <div className="flex justify-between items-center mb-1.5"><span className="text-xs text-slate-400">{label}</span><span className="text-xs font-semibold text-white">{value}</span></div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${color} rounded-full`} style={{ width }} /></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
