"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGoogleLogin } from "@react-oauth/google";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { AuthLinkFooter, AuthShell } from "@/components/auth/AuthShell";

type AuthView = "login" | "forgot" | "sent";

export default function LoginPage() {
  const router = useRouter();
  const [authView, setAuthView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, rememberMe }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? "Credenciais inválidas");
      }
      router.push("/overview");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 501) {
        setAuthView("sent");
        return;
      }
      if (!res.ok) throw new Error("Não foi possível enviar o e-mail");
      setAuthView("sent");
    } catch {
      // UI segue o fluxo prevconsulta mesmo com backend stub.
      setAuthView("sent");
    } finally {
      setLoading(false);
    }
  }

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ accessToken: tokenResponse.access_token }),
        });
        if (!res.ok) throw new Error("Falha no login com Google");
        router.push("/overview");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha no login com Google");
      } finally {
        setLoading(false);
      }
    },
    onError: () => setError("Falha no login com Google"),
  });

  if (authView === "forgot") {
    return (
      <AuthShell
        title="Recuperar senha"
        subtitle="Informe seu e-mail para receber instruções de redefinição."
        footer={
          <button
            type="button"
            onClick={() => setAuthView("login")}
            className="mt-6 w-full text-sm text-slate-400 hover:text-white"
          >
            Voltar para o login
          </button>
        }
      >
        <form onSubmit={(e) => void handleForgot(e)} className="space-y-4">
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
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#22C55E] py-3 font-semibold text-[#020617] transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Enviando..." : "Enviar instruções"}
          </button>
        </form>
      </AuthShell>
    );
  }

  if (authView === "sent") {
    return (
      <AuthShell
        title="Verifique seu e-mail"
        subtitle="Se existir uma conta com esse endereço, enviaremos instruções em breve."
      >
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-sm text-slate-300">
          Caso não receba em alguns minutos, confira a caixa de spam ou tente novamente.
        </div>
        <button
          type="button"
          onClick={() => setAuthView("login")}
          className="mt-6 w-full rounded-xl border border-white/10 py-3 text-sm text-slate-200 hover:bg-white/5"
        >
          Voltar para o login
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Bem-vindo de volta"
      subtitle="Entre na sua conta para continuar."
      footer={
        <AuthLinkFooter
          text="Ainda não tem conta?"
          linkText="Criar conta"
          href="/register"
        />
      }
    >
      <form onSubmit={(e) => void handleLogin(e)} className="space-y-4">
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-900/80 py-3 pl-10 pr-12 outline-none ring-[#22C55E]/40 focus:ring-2"
              placeholder="••••••••"
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

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-slate-400">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-slate-900 accent-[#22C55E]"
            />
            Lembrar-me
          </label>
          <button
            type="button"
            onClick={() => setAuthView("forgot")}
            className="text-[#6366F1] hover:underline"
          >
            Esqueci a senha
          </button>
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[#22C55E] py-3 font-semibold text-[#020617] transition hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs uppercase tracking-wide text-slate-500">ou</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <button
        type="button"
        onClick={() => googleLogin()}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-slate-900/60 py-3 text-sm font-medium text-slate-100 hover:bg-white/5 disabled:opacity-60"
      >
        <span className="text-base">G</span>
        Continuar com Google
      </button>

      <p className="mt-6 text-center text-xs text-slate-500">
        Ao continuar, você concorda com os{" "}
        <Link href="/" className="text-slate-300 hover:underline">
          termos de uso
        </Link>
        .
      </p>
    </AuthShell>
  );
}
