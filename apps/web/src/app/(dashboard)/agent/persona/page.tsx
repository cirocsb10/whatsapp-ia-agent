"use client";

import { Header } from "@/components/layout/Header";
import { useAgentConfig, useUpdateAgentConfig } from "@/features/agent/api/queries";
import { centsToMaskedPrice, maskedPriceToCents } from "@/lib/decimal-mask";
import { normalizeBusinessHours } from "@/lib/persona";
import { DEFAULT_FORM, FIXED_LLM_MODEL, TONES, type FormState } from "@/features/agent/model/persona-form";
import { IdentitySection } from "@/features/agent/components/persona/IdentitySection";
import { MessagesSection } from "@/features/agent/components/persona/MessagesSection";
import { HandoffSection } from "@/features/agent/components/persona/HandoffSection";
import { BusinessHoursSection } from "@/features/agent/components/persona/BusinessHoursSection";
import { ModelSection } from "@/features/agent/components/persona/ModelSection";
import { PersonaPreview } from "@/features/agent/components/persona/PersonaPreview";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Sparkles, MessageCircle, ChevronLeft, CheckCircle2, AlertCircle } from "lucide-react";

export default function PersonaPage() {
  const configQuery = useAgentConfig();
  const updateConfig = useUpdateAgentConfig();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const loading = configQuery.isPending && !hydrated;
  const saving = updateConfig.isPending;

  useEffect(() => {
    const data = configQuery.data;
    if (!data || hydrated) return;
    setForm((current) => ({
      ...current,
      ...data,
      llmModel: FIXED_LLM_MODEL.value,
      handoffOrderValueBrl: data.handoffOrderValueBrl != null
        ? centsToMaskedPrice(Math.round(Number(data.handoffOrderValueBrl) * 100))
        : "",
      businessHours: normalizeBusinessHours(data.businessHours),
      inactivityTimeoutMin: data.inactivityTimeoutMin ?? DEFAULT_FORM.inactivityTimeoutMin,
      sessionTtlHours: data.sessionTtlHours ?? DEFAULT_FORM.sessionTtlHours,
      maxConversationLength: data.maxConversationLength ?? DEFAULT_FORM.maxConversationLength,
      maxResponseLength: data.maxResponseLength ?? DEFAULT_FORM.maxResponseLength,
      systemPromptBase: data.systemPromptBase ?? "",
    }));
    setHydrated(true);
  }, [configQuery.data, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  async function handleSave() {
    try {
      const payload: Record<string, unknown> = {
        agentName: form.agentName,
        tone: form.tone,
        greetingMessage: form.greetingMessage,
        inactivityMessage: form.inactivityMessage,
        closingMessage: form.closingMessage,
        outOfHoursMessage: form.outOfHoursMessage,
        handoffMessage: form.handoffMessage,
        autoHandoffThreshold: form.autoHandoffThreshold,
        handoffOrderValueBrl: (() => {
          const cents = maskedPriceToCents(form.handoffOrderValueBrl);
          return cents === null ? null : cents / 100;
        })(),
        inactivityTimeoutMin: form.inactivityTimeoutMin || DEFAULT_FORM.inactivityTimeoutMin,
        sessionTtlHours: form.sessionTtlHours || DEFAULT_FORM.sessionTtlHours,
        maxConversationLength: form.maxConversationLength || DEFAULT_FORM.maxConversationLength,
        businessHours: form.businessHours,
        llmModel: FIXED_LLM_MODEL.value,
        llmTemperature: form.llmTemperature,
        maxResponseLength: form.maxResponseLength,
        systemPromptBase: form.systemPromptBase,
        isPublished: form.isPublished,
      };
      await updateConfig.mutateAsync(payload);
      setDirty(false);
      setToast({ type: "success", msg: "Persona salva com sucesso" });
    } catch {
      setToast({ type: "error", msg: "Erro ao salvar persona" });
    }
  }

  const toneMeta = TONES.find((t) => t.value === form.tone) ?? TONES[2];

  const previewTime = useMemo(
    () =>
      new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  );

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {toast && (
        <div className={`persona-toast persona-toast--${toast.type}`}>
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {toast.msg}
        </div>
      )}

      <div className="fade-up flex flex-col flex-1 min-h-0 overflow-y-auto">
        <Header
          title="Persona do Agente"
          subtitle="Identidade, tom de voz e comportamento da IA"
        />

        <div className="dashboard-page persona-page">
        {/* Hero */}
        <div className={`persona-hero ${form.isPublished ? "persona-hero--live" : ""}`}>
          <div className="persona-hero-glow persona-hero-glow--indigo" aria-hidden="true" />
          <div className="persona-hero-glow persona-hero-glow--violet" aria-hidden="true" />

          <div className="persona-hero-content">
            <div className="flex-1 min-w-0">
              <div className="persona-hero-badge">
                <Sparkles className="w-3 h-3" strokeWidth={2} />
                Identidade do agente
              </div>
              <h2 className="persona-hero-title">
                {loading ? "Carregando…" : form.agentName || "Assistente"}
              </h2>
              <p className="persona-hero-sub">
                Tom <span className="persona-hero-accent">{toneMeta.label.toLowerCase()}</span>
                {" · "}
                {FIXED_LLM_MODEL.label}
                {" · "}
                temp. {form.llmTemperature.toFixed(1)}
              </p>
            </div>

            <span
              className={`persona-status-pill ${form.isPublished ? "persona-status-pill--live" : ""}`}
            >
              {form.isPublished ? (
                <>
                  <span className="persona-status-dot" />
                  Publicado
                </>
              ) : (
                "Rascunho"
              )}
            </span>
          </div>
        </div>

        {/* Info banner */}
        <div className="persona-info-banner">
          <div className="persona-info-icon">
            <MessageCircle className="w-4 h-4 text-indigo-400" strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="persona-info-title">Como a persona funciona</p>
            <p className="persona-info-desc">
              A persona define como seu agente se apresenta e responde no WhatsApp.
              Ajuste o tom e as mensagens — o preview à direita atualiza em tempo real.
            </p>
          </div>
          <Link href="/agent" className="persona-info-link">
            <ChevronLeft className="persona-info-link-chevron" strokeWidth={1.5} />
            Voltar ao agente
          </Link>
        </div>

        <div className="persona-layout">
          {/* Form column */}
          <div className="persona-form-col">
            <IdentitySection form={form} patch={patch} loading={loading} />
            <MessagesSection form={form} patch={patch} loading={loading} />
            <HandoffSection form={form} patch={patch} loading={loading} />
            <BusinessHoursSection form={form} patch={patch} loading={loading} />
            <ModelSection form={form} patch={patch} loading={loading} />
          </div>

          <PersonaPreview form={form} previewTime={previewTime} />
        </div>
      </div>
      </div>

      <div className="persona-save-bar">
        <p className={`persona-save-hint${dirty ? " persona-save-hint--dirty" : ""}`}>
          {dirty ? "Alterações não salvas" : "Nenhuma alteração pendente"}
        </p>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || loading || !dirty}
          className="catalog-add-btn"
          style={{ minWidth: 120 }}
        >
          {saving ? "Salvando…" : "Salvar persona"}
        </button>
      </div>
    </div>
  );
}
