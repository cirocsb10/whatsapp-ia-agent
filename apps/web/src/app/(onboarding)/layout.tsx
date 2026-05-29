import Link from "next/link";
import { MessageSquare } from "lucide-react";
const STEPS = [{ id: 1, label: "Conta" }, { id: 2, label: "Empresa" }, { id: 3, label: "WhatsApp" }, { id: 4, label: "Produtos" }, { id: 5, label: "Plano" }];
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#020617] flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#1E293B]">
        <Link href="/" className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center"><MessageSquare className="w-4 h-4 text-green-400" /></div><span className="font-bold text-white">Whats<span className="text-green-400">Agent</span></span></Link>
        <div className="flex items-center gap-1">{STEPS.map((s, i) => (<div key={s.id} className="flex items-center"><div className="flex items-center gap-1.5"><div className="w-6 h-6 rounded-full bg-[#1E293B] border border-[#334155] flex items-center justify-center text-[10px] text-slate-400">{s.id}</div><span className="text-xs text-slate-500 hidden md:block">{s.label}</span></div>{i < STEPS.length-1 && <div className="w-8 h-px bg-[#1E293B] mx-2" />}</div>))}</div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-10"><div className="w-full max-w-lg">{children}</div></main>
    </div>
  );
}
