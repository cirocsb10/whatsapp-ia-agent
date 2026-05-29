import { Header } from "@/components/layout/Header";
import { CheckCircle, XCircle } from "lucide-react";

const TENANTS = [
  { id: "1", name: "Loja da Maria", slug: "loja-da-maria", status: "ACTIVE", planType: "GROWTH", whatsappStatus: "CONNECTED", messagesThisMonth: 1247, messagesLimit: 3000, totalRevenue: 1249700, totalConversations: 1247 },
  { id: "2", name: "Padaria Bella", slug: "padaria-bella", status: "TRIAL", planType: "STARTER", whatsappStatus: "DISCONNECTED", messagesThisMonth: 45, messagesLimit: 100, totalRevenue: 0, totalConversations: 45 },
];
const kpis = { total_tenants: 2, active_tenants: 1, total_conversations: 1292, total_revenue_cents: 1249700 };

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, string> = { ACTIVE: "bg-green-500/10 text-green-400 border-green-500/20", TRIAL: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", SUSPENDED: "bg-red-500/10 text-red-400 border-red-500/20", CANCELLED: "bg-slate-700 text-slate-500 border-slate-600" };
  const labels: Record<string, string> = { ACTIVE: "Ativo", TRIAL: "Trial", SUSPENDED: "Suspenso", CANCELLED: "Cancelado" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${m[status] ?? m["SUSPENDED"]}`}>{labels[status] ?? status}</span>;
}

export default function TenantsPage() {
  return (
    <div className="animate-fade-in">
      <Header title="Super Admin" subtitle={`${TENANTS.length} tenants na plataforma`} />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[{ label: "Total Tenants", value: kpis.total_tenants }, { label: "Tenants Ativos", value: kpis.active_tenants }, { label: "Conversas", value: kpis.total_conversations.toLocaleString("pt-BR") }, { label: "Receita Total", value: `R$ ${(kpis.total_revenue_cents/100).toLocaleString("pt-BR")}` }].map((k) => <div key={k.label} className="glass-card p-4"><p className="text-xs text-slate-500 mb-1">{k.label}</p><p className="text-xl font-bold text-white">{k.value}</p></div>)}
        </div>
        <div className="glass-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1E293B]"><h3 className="text-sm font-semibold text-white">Todos os Tenants</h3></div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[#1E293B]">{["Tenant","Plano","WhatsApp","Msgs/Limite","Receita","Status"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>)}</tr></thead>
            <tbody>{TENANTS.map((t) => (
              <tr key={t.id} className="border-b border-[#1E293B]/50 hover:bg-[#0F172A]/50">
                <td className="px-4 py-3"><p className="font-medium text-white">{t.name}</p><p className="text-xs text-slate-500">{t.slug}.whatsagent.com.br</p></td>
                <td className="px-4 py-3"><span className="text-xs px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20">{t.planType}</span></td>
                <td className="px-4 py-3"><span className={`flex items-center gap-1 text-xs ${t.whatsappStatus === "CONNECTED" ? "text-green-400" : "text-slate-500"}`}>{t.whatsappStatus === "CONNECTED" ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}{t.whatsappStatus}</span></td>
                <td className="px-4 py-3 text-slate-400 text-xs">{t.messagesThisMonth}/{t.messagesLimit}<div className="w-20 h-1 bg-slate-800 rounded-full mt-1"><div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(100,(t.messagesThisMonth/t.messagesLimit)*100)}%` }} /></div></td>
                <td className="px-4 py-3 text-green-400 font-medium text-xs">R$ {((t.totalRevenue??0)/100).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
