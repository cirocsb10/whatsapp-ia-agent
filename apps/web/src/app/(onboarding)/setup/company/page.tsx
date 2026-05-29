"use client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, ArrowRight } from "lucide-react";

const schema = z.object({ name: z.string().min(2,"Nome muito curto").max(100), slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens"), timezone: z.string() });
type F = z.infer<typeof schema>;

export default function CompanySetupPage() {
  const router = useRouter();
  const form = useForm<F>({ resolver: zodResolver(schema), defaultValues: { timezone: "America/Sao_Paulo" } });
  async function onSubmit(data: F) { console.log("Company setup:", data); router.push("/setup/plan"); }
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center"><div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 mb-4"><Building2 className="w-6 h-6 text-indigo-400" /></div><h1 className="text-2xl font-bold text-white">Sobre sua empresa</h1><p className="text-slate-500 mt-1.5 text-sm">Essas informações identificam seu espaço no WhatsAgent</p></div>
      <div className="glass-card p-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div><label className="text-slate-400 text-sm mb-1.5 block">Nome da empresa *</label><input {...form.register("name")} placeholder="Ex: Loja da Maria" className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 h-11" />{form.formState.errors.name && <p className="text-red-400 text-xs mt-1">{form.formState.errors.name.message}</p>}</div>
          <div><label className="text-slate-400 text-sm mb-1.5 block">Subdomínio único *</label><div className="flex items-center"><input {...form.register("slug")} placeholder="minha-loja" className="flex-1 bg-[#0F172A] border border-[#334155] rounded-l-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 h-11" /><span className="flex items-center h-11 px-3 bg-[#1E293B] border border-l-0 border-[#334155] rounded-r-xl text-slate-500 text-sm whitespace-nowrap">.whatsagent.com.br</span></div></div>
          <button type="submit" disabled={form.formState.isSubmitting} className="w-full h-11 bg-green-500 hover:bg-green-400 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer">Continuar <ArrowRight className="w-4 h-4" /></button>
        </form>
      </div>
    </div>
  );
}
