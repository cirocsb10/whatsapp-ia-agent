"use client";

import { Header } from "@/components/layout/Header";
import { useApi } from "@/lib/hooks/useApi";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle, Mail, Send, Server, Shield, XCircle } from "lucide-react";

interface SmtpSettings {
  host: string | null;
  port: number;
  username: string | null;
  secure: boolean;
  fromEmail: string | null;
  fromName: string | null;
  hasPassword: boolean;
  configured: boolean;
}

interface FormState {
  host: string;
  port: string;
  username: string;
  password: string;
  secure: boolean;
  fromEmail: string;
  fromName: string;
}

type Feedback = { type: "success" | "error"; message: string };

const EMPTY_FORM: FormState = {
  host: "",
  port: "587",
  username: "",
  password: "",
  secure: false,
  fromEmail: "",
  fromName: "",
};

export default function PlatformEmailPage() {
  const { apiFetch } = useApi();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [hasPassword, setHasPassword] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testFeedback, setTestFeedback] = useState<Feedback | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/super-admin/email/smtp");
      if (res.ok) {
        const data = (await res.json()) as SmtpSettings;
        setForm({
          host: data.host ?? "",
          port: String(data.port ?? 587),
          username: data.username ?? "",
          password: "",
          secure: Boolean(data.secure),
          fromEmail: data.fromEmail ?? "",
          fromName: data.fromName ?? "",
        });
        setHasPassword(data.hasPassword);
        setConfigured(data.configured);
        setPasswordTouched(false);
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setFeedback(null);
    try {
      const payload: Record<string, unknown> = {
        host: form.host,
        port: Number(form.port) || 587,
        username: form.username,
        secure: form.secure,
        fromEmail: form.fromEmail,
        fromName: form.fromName,
      };
      // Só reenvia a senha se o usuário digitou uma nova.
      if (passwordTouched && form.password) {
        payload.password = form.password;
      }

      const res = await apiFetch("/super-admin/email/smtp", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = (await res.json()) as SmtpSettings;
        setHasPassword(data.hasPassword);
        setConfigured(data.configured);
        setPasswordTouched(false);
        update("password", "");
        setFeedback({ type: "success", message: "Configurações SMTP salvas com sucesso." });
      } else {
        const err = (await res.json().catch(() => null)) as { message?: string } | null;
        setFeedback({
          type: "error",
          message: err?.message ?? "Não foi possível salvar as configurações.",
        });
      }
    } catch {
      setFeedback({ type: "error", message: "Erro de rede ao salvar as configurações." });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestFeedback(null);
    try {
      const payload: Record<string, unknown> = {
        to: testTo,
        host: form.host,
        port: Number(form.port) || 587,
        username: form.username,
        secure: form.secure,
        fromEmail: form.fromEmail,
        fromName: form.fromName,
      };
      if (passwordTouched && form.password) {
        payload.password = form.password;
      }

      const res = await apiFetch("/super-admin/email/smtp/test", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setTestFeedback({
          type: "success",
          message: `E-mail de teste enviado para ${testTo}.`,
        });
      } else {
        const err = (await res.json().catch(() => null)) as { message?: string } | null;
        setTestFeedback({
          type: "error",
          message: err?.message ?? "Falha ao enviar o e-mail de teste.",
        });
      }
    } catch {
      setTestFeedback({ type: "error", message: "Erro de rede ao enviar o e-mail de teste." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="fade-up flex flex-col min-h-full">
      <Header
        title="Email da Plataforma"
        subtitle="Configuração SMTP global para emails do sistema"
      />

      <div className="dashboard-page space-y-5 max-w-3xl">
        <section className="super-admin-hero">
          <div className="relative z-10 space-y-2">
            <span className="super-admin-badge">
              <Shield className="w-3 h-3" aria-hidden />
              Controle da plataforma
            </span>
            <p className="dashboard-greeting-title">Servidor de Email (SMTP)</p>
            <p className="dashboard-greeting-sub max-w-xl">
              Credenciais usadas para enviar emails do sistema (billing, alertas, onboarding).
              A senha é criptografada em repouso e nunca retorna em claro.
            </p>
          </div>
          <div className="relative z-10 text-right hidden sm:block">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Status</p>
            <p
              className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                configured ? "text-green-400" : "text-slate-400"
              }`}
            >
              {configured ? (
                <CheckCircle className="w-4 h-4" aria-hidden />
              ) : (
                <XCircle className="w-4 h-4" aria-hidden />
              )}
              {configured ? "Configurado" : "Não configurado"}
            </p>
          </div>
        </section>

        {/* Formulário SMTP */}
        <div className="super-admin-table-wrap p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--c-border)] pb-3">
            <Server className="w-4 h-4 text-indigo-400" aria-hidden />
            <h3 className="text-sm font-semibold text-white">Credenciais do servidor</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Host SMTP">
              <input
                className="settings-input"
                placeholder="smtp.gmail.com"
                value={form.host}
                onChange={(e) => update("host", e.target.value)}
                disabled={loading}
              />
            </Field>
            <Field label="Porta">
              <input
                className="settings-input"
                type="number"
                placeholder="587"
                value={form.port}
                onChange={(e) => update("port", e.target.value)}
                disabled={loading}
              />
            </Field>
            <Field label="Usuário">
              <input
                className="settings-input"
                placeholder="usuario@dominio.com"
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
                disabled={loading}
              />
            </Field>
            <Field
              label="Senha"
              {...(hasPassword ? { hint: "Deixe em branco para manter a senha atual." } : {})}
            >
              <input
                className="settings-input"
                type="password"
                placeholder={hasPassword ? "••••••••" : "Senha SMTP"}
                value={form.password}
                onChange={(e) => {
                  setPasswordTouched(true);
                  update("password", e.target.value);
                }}
                disabled={loading}
              />
            </Field>
            <Field label="E-mail remetente">
              <input
                className="settings-input"
                type="email"
                placeholder="no-reply@whatsagent.com.br"
                value={form.fromEmail}
                onChange={(e) => update("fromEmail", e.target.value)}
                disabled={loading}
              />
            </Field>
            <Field label="Nome remetente">
              <input
                className="settings-input"
                placeholder="WhatsAgent"
                value={form.fromName}
                onChange={(e) => update("fromName", e.target.value)}
                disabled={loading}
              />
            </Field>
          </div>

          <label className="flex items-center gap-3 pt-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.secure}
              onChange={(e) => update("secure", e.target.checked)}
              disabled={loading}
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-[#22c55e]"
            />
            <span className="text-[13px] text-slate-300">
              Conexão segura (TLS/SSL) — ative para porta 465
            </span>
          </label>

          {feedback && (
            <p
              className={`text-[13px] ${
                feedback.type === "success" ? "text-green-400" : "text-rose-400"
              }`}
            >
              {feedback.message}
            </p>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-3.5 h-3.5" aria-hidden />
              {saving ? "Salvando…" : "Salvar configurações"}
            </button>
          </div>
        </div>

        {/* Enviar email de teste */}
        <div className="super-admin-table-wrap p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--c-border)] pb-3">
            <Mail className="w-4 h-4 text-indigo-400" aria-hidden />
            <h3 className="text-sm font-semibold text-white">Enviar e-mail de teste</h3>
          </div>
          <p className="text-[12px] text-slate-500 -mt-1">
            Usa os valores do formulário acima (salvos ou não) para validar o envio.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <Field label="Destinatário">
                <input
                  className="settings-input"
                  type="email"
                  placeholder="voce@dominio.com"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  disabled={loading}
                />
              </Field>
            </div>
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={testing || loading || !testTo}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed h-[38px]"
            >
              <Send className="w-3.5 h-3.5" aria-hidden />
              {testing ? "Enviando…" : "Enviar teste"}
            </button>
          </div>

          {testFeedback && (
            <p
              className={`text-[13px] ${
                testFeedback.type === "success" ? "text-green-400" : "text-rose-400"
              }`}
            >
              {testFeedback.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-medium text-slate-300">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}
