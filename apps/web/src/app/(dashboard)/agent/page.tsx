import { Header } from "@/components/layout/Header";
import { TestSimulator } from "@/components/agent/TestSimulator";
import { Bot, Shield, Database, Settings } from "lucide-react";
import Link from "next/link";

export default function AgentPage() {
  return (
    <div className="animate-fade-in">
      <Header title="Agente IA" subtitle="Configure o comportamento do agente" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[{ href: "/agent/persona", label: "Persona", icon: Bot, desc: "Nome, tom e saudação" }, { href: "/agent/knowledge", label: "Base de Conhecimento", icon: Database, desc: "FAQs e documentos" }, { href: "/agent/rules", label: "Regras", icon: Shield, desc: "Guard rails anti-alucinação" }, { href: "/settings", label: "Configurações", icon: Settings, desc: "Integrações e avançado" }].map(({ href, label, icon: Icon, desc }) => (
            <Link key={href} href={href} className="glass-card p-4 hover:border-slate-600 transition-colors cursor-pointer block"><Icon className="w-8 h-8 text-indigo-400 mb-2" /><p className="text-sm font-semibold text-white">{label}</p><p className="text-xs text-slate-500 mt-0.5">{desc}</p></Link>
          ))}
        </div>
        <TestSimulator tenantId="dev-tenant" />
      </div>
    </div>
  );
}
