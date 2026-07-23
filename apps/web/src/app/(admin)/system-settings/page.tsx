"use client";

import { Header } from "@/components/layout/Header";
import { useEffect, useState } from "react";
import {
  CheckCircle,
  Mail,
  Send,
  Server,
  Shield,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import { ApiError } from "@/shared/api/fetcher";
import {
  useSmtpSettings,
  useSaveSmtp,
  useTestSmtp,
} from "@/features/admin/api/queries";
import {
  usePlatformSettings,
  useSavePlatformSettings,
  type PlatformSettings,
} from "@/features/admin/api/platform-settings";

interface SmtpFormState {
  host: string;
  port: string;
  username: string;
  password: string;
  secure: boolean;
  fromEmail: string;
  fromName: string;
}

type Feedback = { type: "success" | "error"; message: string };

const EMPTY_SMTP: SmtpFormState = {
  host: "",
  port: "587",
  username: "",
  password: "",
  secure: false,
  fromEmail: "",
  fromName: "",
};

const EMPTY_FLAGS = {
  maintenanceMode: false,
  maintenanceMessage: "",
  newTenantRegistrationOpen: true,
  defaultTrialDays: "7",
  defaultConversationsLimit: "100",
  STARTER: "100",
  GROWTH: "1000",
  SCALE: "5000",
  ENTERPRISE: "20000",
};

export default function SystemSettingsPage() {
  const settingsQuery = usePlatformSettings();
  const saveSettings = useSavePlatformSettings();
  const smtpQuery = useSmtpSettings();
  const saveSmtp = useSaveSmtp();
  const testSmtp = useTestSmtp();

  const [flags, setFlags] = useState(EMPTY_FLAGS);
  const [flagsHydrated, setFlagsHydrated] = useState(false);
  const [flagsFeedback, setFlagsFeedback] = useState<Feedback | null>(null);

  const [smtp, setSmtp] = useState<SmtpFormState>(EMPTY_SMTP);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [smtpHydrated, setSmtpHydrated] = useState(false);
  const [smtpFeedback, setSmtpFeedback] = useState<Feedback | null>(null);
  const [testTo, setTestTo] = useState("");
  const [testFeedback, setTestFeedback] = useState<Feedback | null>(null);

  const hasPassword = smtpQuery.data?.hasPassword ?? false;
  const configured = smtpQuery.data?.configured ?? false;

  useEffect(() => {
    const data = settingsQuery.data;
    if (!data || flagsHydrated) return;
    setFlags({
      maintenanceMode: data.maintenanceMode,
      maintenanceMessage: data.maintenanceMessage ?? "",
      newTenantRegistrationOpen: data.newTenantRegistrationOpen,
      defaultTrialDays: String(data.defaultTrialDays),
      defaultConversationsLimit: String(data.defaultConversationsLimit),
      STARTER: String(data.planConversationLimits.STARTER),
      GROWTH: String(data.planConversationLimits.GROWTH),
      SCALE: String(data.planConversationLimits.SCALE),
      ENTERPRISE: String(data.planConversationLimits.ENTERPRISE),
    });
    setFlagsHydrated(true);
  }, [settingsQuery.data, flagsHydrated]);

  useEffect(() => {
    const data = smtpQuery.data;
    if (!data || smtpHydrated) return;
    setSmtp({
      host: data.host ?? "",
      port: String(data.port ?? 587),
      username: data.username ?? "",
      password: "",
      secure: Boolean(data.secure),
      fromEmail: data.fromEmail ?? "",
      fromName: data.fromName ?? "",
    });
    setPasswordTouched(false);
    setSmtpHydrated(true);
  }, [smtpQuery.data, smtpHydrated]);

  async function handleSaveFlags() {
    setFlagsFeedback(null);
    try {
      const payload: Partial<PlatformSettings> = {
        maintenanceMode: flags.maintenanceMode,
        maintenanceMessage: flags.maintenanceMessage || null,
        newTenantRegistrationOpen: flags.newTenantRegistrationOpen,
        defaultTrialDays: Number(flags.defaultTrialDays) || 0,
        defaultConversationsLimit: Number(flags.defaultConversationsLimit) || 1,
        planConversationLimits: {
          STARTER: Number(flags.STARTER) || 100,
          GROWTH: Number(flags.GROWTH) || 1000,
          SCALE: Number(flags.SCALE) || 5000,
          ENTERPRISE: Number(flags.ENTERPRISE) || 20000,
        },
      };
      await saveSettings.mutateAsync(payload);
      setFlagsFeedback({ type: "success", message: "Configurações salvas." });
    } catch (err) {
      setFlagsFeedback({
        type: "error",
        message:
          err instanceof ApiError
            ? err.message || "Falha ao salvar."
            : "Erro de rede ao salvar.",
      });
    }
  }

  async function handleSaveSmtp() {
    setSmtpFeedback(null);
    try {
      const payload: Record<string, unknown> = {
        host: smtp.host,
        port: Number(smtp.port) || 587,
        username: smtp.username,
        secure: smtp.secure,
        fromEmail: smtp.fromEmail,
        fromName: smtp.fromName,
      };
      if (passwordTouched && smtp.password) {
        payload.password = smtp.password;
      }
      await saveSmtp.mutateAsync(payload);
      setPasswordTouched(false);
      setSmtp((prev) => ({ ...prev, password: "" }));
      setSmtpFeedback({ type: "success", message: "SMTP salvo com sucesso." });
    } catch (err) {
      setSmtpFeedback({
        type: "error",
        message:
          err instanceof ApiError
            ? err.message || "Falha ao salvar SMTP."
            : "Erro de rede ao salvar SMTP.",
      });
    }
  }

  async function handleTestSmtp() {
    setTestFeedback(null);
    try {
      const payload: Record<string, unknown> = {
        to: testTo,
        host: smtp.host,
        port: Number(smtp.port) || 587,
        username: smtp.username,
        secure: smtp.secure,
        fromEmail: smtp.fromEmail,
        fromName: smtp.fromName,
      };
      if (passwordTouched && smtp.password) {
        payload.password = smtp.password;
      }
      await testSmtp.mutateAsync(payload);
      setTestFeedback({
        type: "success",
        message: `E-mail de teste enviado para ${testTo}.`,
      });
    } catch (err) {
      setTestFeedback({
        type: "error",
        message:
          err instanceof ApiError
            ? err.message || "Falha no teste."
            : "Erro de rede no teste.",
      });
    }
  }

  return (
    <div className="fade-up flex flex-col min-h-full">
      <Header
        title="Configurações do Sistema"
        subtitle="Flags da plataforma, defaults de billing e SMTP"
      />

      <div className="dashboard-page space-y-5 max-w-3xl">
        <section className="super-admin-hero">
          <div className="relative z-10 space-y-2">
            <span className="super-admin-badge">
              <Shield className="w-3 h-3" aria-hidden />
              Controle da plataforma
            </span>
            <p className="dashboard-greeting-title">Configurações gerais</p>
            <p className="dashboard-greeting-sub max-w-xl">
              Manutenção, registro de tenants, limites por plano e servidor SMTP
              do sistema.
            </p>
          </div>
          <div className="relative z-10 hidden sm:flex items-center gap-2 text-slate-500">
            <SlidersHorizontal className="w-8 h-8 opacity-40" aria-hidden />
          </div>
        </section>

        {/* Flags */}
        <div className="super-admin-table-wrap p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--c-border)] pb-3">
            <SlidersHorizontal className="w-4 h-4 text-indigo-600" aria-hidden />
            <h3 className="text-sm font-semibold text-slate-900">Flags do sistema</h3>
          </div>

          <Toggle
            label="Modo manutenção"
            description="Exibe mensagem de manutenção (enforçamento futuro)."
            checked={flags.maintenanceMode}
            onChange={(v) => setFlags((p) => ({ ...p, maintenanceMode: v }))}
            disabled={settingsQuery.isLoading}
          />

          <Field label="Mensagem de manutenção">
            <input
              className="settings-input"
              value={flags.maintenanceMessage}
              onChange={(e) =>
                setFlags((p) => ({ ...p, maintenanceMessage: e.target.value }))
              }
              disabled={settingsQuery.isLoading}
              placeholder="Estamos em manutenção. Volte em breve."
            />
          </Field>

          <Toggle
            label="Registro de novos tenants"
            description="Quando desligado, novos cadastros devem ser bloqueados (enforçamento futuro)."
            checked={flags.newTenantRegistrationOpen}
            onChange={(v) =>
              setFlags((p) => ({ ...p, newTenantRegistrationOpen: v }))
            }
            disabled={settingsQuery.isLoading}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dias de trial padrão">
              <input
                className="settings-input"
                type="number"
                min={0}
                value={flags.defaultTrialDays}
                onChange={(e) =>
                  setFlags((p) => ({ ...p, defaultTrialDays: e.target.value }))
                }
                disabled={settingsQuery.isLoading}
              />
            </Field>
            <Field label="Limite padrão de conversas">
              <input
                className="settings-input"
                type="number"
                min={1}
                value={flags.defaultConversationsLimit}
                onChange={(e) =>
                  setFlags((p) => ({
                    ...p,
                    defaultConversationsLimit: e.target.value,
                  }))
                }
                disabled={settingsQuery.isLoading}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {(["STARTER", "GROWTH", "SCALE", "ENTERPRISE"] as const).map((plan) => (
              <Field key={plan} label={`Limite ${plan}`}>
                <input
                  className="settings-input"
                  type="number"
                  min={1}
                  value={flags[plan]}
                  onChange={(e) =>
                    setFlags((p) => ({ ...p, [plan]: e.target.value }))
                  }
                  disabled={settingsQuery.isLoading}
                />
              </Field>
            ))}
          </div>

          {flagsFeedback && (
            <p
              className={`text-[13px] ${
                flagsFeedback.type === "success" ? "text-green-600" : "text-rose-600"
              }`}
            >
              {flagsFeedback.message}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSaveFlags()}
              disabled={saveSettings.isPending || settingsQuery.isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-green-500/20 text-green-600 border border-green-500/30 hover:bg-green-500/30 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-3.5 h-3.5" aria-hidden />
              {saveSettings.isPending ? "Salvando…" : "Salvar flags"}
            </button>
          </div>
        </div>

        {/* SMTP */}
        <div className="super-admin-table-wrap p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--c-border)] pb-3">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-600" aria-hidden />
              <h3 className="text-sm font-semibold text-slate-900">SMTP da plataforma</h3>
            </div>
            <p
              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                configured ? "text-green-600" : "text-slate-500"
              }`}
            >
              {configured ? (
                <CheckCircle className="w-3.5 h-3.5" aria-hidden />
              ) : (
                <XCircle className="w-3.5 h-3.5" aria-hidden />
              )}
              {configured ? "Configurado" : "Não configurado"}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Host SMTP">
              <input
                className="settings-input"
                value={smtp.host}
                onChange={(e) => setSmtp((p) => ({ ...p, host: e.target.value }))}
                disabled={smtpQuery.isLoading}
              />
            </Field>
            <Field label="Porta">
              <input
                className="settings-input"
                type="number"
                value={smtp.port}
                onChange={(e) => setSmtp((p) => ({ ...p, port: e.target.value }))}
                disabled={smtpQuery.isLoading}
              />
            </Field>
            <Field label="Usuário">
              <input
                className="settings-input"
                value={smtp.username}
                onChange={(e) => setSmtp((p) => ({ ...p, username: e.target.value }))}
                disabled={smtpQuery.isLoading}
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
                value={smtp.password}
                onChange={(e) => {
                  setPasswordTouched(true);
                  setSmtp((p) => ({ ...p, password: e.target.value }));
                }}
                disabled={smtpQuery.isLoading}
              />
            </Field>
            <Field label="E-mail remetente">
              <input
                className="settings-input"
                type="email"
                value={smtp.fromEmail}
                onChange={(e) => setSmtp((p) => ({ ...p, fromEmail: e.target.value }))}
                disabled={smtpQuery.isLoading}
              />
            </Field>
            <Field label="Nome remetente">
              <input
                className="settings-input"
                value={smtp.fromName}
                onChange={(e) => setSmtp((p) => ({ ...p, fromName: e.target.value }))}
                disabled={smtpQuery.isLoading}
              />
            </Field>
          </div>

          <label className="flex items-center gap-3 pt-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={smtp.secure}
              onChange={(e) => setSmtp((p) => ({ ...p, secure: e.target.checked }))}
              disabled={smtpQuery.isLoading}
              className="h-4 w-4 rounded border-slate-300 bg-white accent-[#22c55e]"
            />
            <span className="text-[13px] text-slate-900">
              Conexão segura (TLS/SSL) — ative para porta 465
            </span>
          </label>

          {smtpFeedback && (
            <p
              className={`text-[13px] ${
                smtpFeedback.type === "success" ? "text-green-600" : "text-rose-600"
              }`}
            >
              {smtpFeedback.message}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSaveSmtp()}
              disabled={saveSmtp.isPending || smtpQuery.isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-green-500/20 text-green-600 border border-green-500/30 hover:bg-green-500/30 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-3.5 h-3.5" aria-hidden />
              {saveSmtp.isPending ? "Salvando…" : "Salvar SMTP"}
            </button>
          </div>
        </div>

        <div className="super-admin-table-wrap p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--c-border)] pb-3">
            <Mail className="w-4 h-4 text-indigo-600" aria-hidden />
            <h3 className="text-sm font-semibold text-slate-900">E-mail de teste</h3>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <Field label="Destinatário">
                <input
                  className="settings-input"
                  type="email"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  disabled={smtpQuery.isLoading}
                />
              </Field>
            </div>
            <button
              type="button"
              onClick={() => void handleTestSmtp()}
              disabled={testSmtp.isPending || smtpQuery.isLoading || !testTo}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-indigo-500/20 text-indigo-600 border border-indigo-500/30 hover:bg-indigo-500/30 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed h-[38px]"
            >
              <Send className="w-3.5 h-3.5" aria-hidden />
              {testSmtp.isPending ? "Enviando…" : "Enviar teste"}
            </button>
          </div>
          {testFeedback && (
            <p
              className={`text-[13px] ${
                testFeedback.type === "success" ? "text-green-600" : "text-rose-600"
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
      <label className="block text-[12px] font-medium text-slate-900">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-slate-300 accent-[#22c55e]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>
        <span className="block text-[13px] font-medium text-slate-900">{label}</span>
        <span className="block text-[11px] text-slate-500 mt-0.5">{description}</span>
      </span>
    </label>
  );
}
