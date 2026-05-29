import Link from "next/link";
import { CheckCircle, ArrowRight } from "lucide-react";
export default function SetupPage() {
  return (
    <div className="space-y-6 animate-fade-in text-center">
      <div><div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 mb-4"><CheckCircle className="w-8 h-8 text-green-400" /></div><h1 className="text-3xl font-bold text-white">Conta criada!</h1><p className="text-slate-500 mt-2">Bem-vindo ao WhatsAgent. Vamos configurar seu agente em minutos.</p></div>
      <div className="glass-card p-6 text-left space-y-3">{["Configure sua empresa e subdomínio","Conecte seu número WhatsApp Business","Adicione seus primeiros produtos","Escolha seu plano"].map((s, i) => (<div key={i} className="flex items-center gap-3"><div className="w-6 h-6 rounded-full bg-[#1E293B] border border-[#334155] flex items-center justify-center text-[10px] text-slate-400">{i+1}</div><span className="text-sm text-slate-300">{s}</span></div>))}</div>
      <Link href="/setup/company" className="flex items-center justify-center gap-2 w-full h-11 bg-green-500 hover:bg-green-400 text-white rounded-xl font-semibold transition-colors">Começar <ArrowRight className="w-4 h-4" /></Link>
    </div>
  );
}
