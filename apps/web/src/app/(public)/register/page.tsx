"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { AuthLinkFooter, AuthShell } from "@/components/auth/AuthShell";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          email,
          password,
          companyName: companyName || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? "Não foi possível criar a conta");
      }
      router.push("/setup");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a conta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Crie sua conta"
      subtitle="Comece o trial e configure seu agente em minutos."
      footer={
        <AuthLinkFooter
          text="Já tem conta?"
          linkText="Entrar"
          href="/login"
        />
      }
    >
      <form onSubmit={(e) => void handleRegister(e)} className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm text-slate-300">Nome</span>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-900/80 py-3 pl-10 pr-4 outline-none ring-[#22C55E]/40 focus:ring-2"
              placeholder="Seu nome"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm text-slate-300">E-mail</span>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-900/80 py-3 pl-10 pr-4 outline-none ring-[#22C55E]/40 focus:ring-2"
              placeholder="voce@empresa.com"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm text-slate-300">Senha</span>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-900/80 py-3 pl-10 pr-12 outline-none ring-[#22C55E]/40 focus:ring-2"
              placeholder="Mínimo 8 caracteres"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm text-slate-300">Nome da empresa (opcional)</span>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 outline-none ring-[#22C55E]/40 focus:ring-2"
            placeholder="Minha Loja"
          />
        </label>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[#22C55E] py-3 font-semibold text-[#020617] transition hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "Criando conta..." : "Criar conta"}
        </button>
      </form>
    </AuthShell>
  );
}
