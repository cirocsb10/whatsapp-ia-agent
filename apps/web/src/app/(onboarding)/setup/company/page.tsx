"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  ArrowRight,
  ArrowLeft,
  Link2,
  Clock,
  Sparkles,
  AlertCircle,
  MessageCircle,
} from "lucide-react";

const schema = z.object({
  name: z.string().min(2, "Nome muito curto").max(100),
  timezone: z.string(),
});
type F = z.infer<typeof schema>;

const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília (GMT-3)" },
  { value: "America/Manaus", label: "Manaus (GMT-4)" },
  { value: "America/Belem", label: "Belém (GMT-3)" },
  { value: "America/Fortaleza", label: "Fortaleza (GMT-3)" },
  { value: "America/Recife", label: "Recife (GMT-3)" },
  { value: "America/Cuiaba", label: "Cuiabá (GMT-4)" },
  { value: "America/Porto_Velho", label: "Porto Velho (GMT-4)" },
  { value: "America/Rio_Branco", label: "Rio Branco (GMT-5)" },
];

function getInitial(name?: string): string | null {
  const trimmed = (name ?? "").trim();
  return trimmed ? (trimmed[0]?.toUpperCase() ?? null) : null;
}

export default function CompanySetupPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [slugDisplay, setSlugDisplay] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

  const form = useForm<F>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", timezone: "America/Sao_Paulo" },
  });

  const name = form.watch("name");

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/settings/company`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        form.reset({
          name: data.name ?? "",
          timezone: data.timezone ?? "America/Sao_Paulo",
        });
        setSlugDisplay(data.slug ?? "");
      } catch {
        // best-effort prefill
      }
    }
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(data: F) {
    setApiError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/settings/company`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: data.name, timezone: data.timezone }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setApiError((body as { message?: string }).message ?? "Erro ao salvar configuracoes.");
        return;
      }

      router.push("/setup/plan");
    } catch {
      setApiError("Erro de conexao. Tente novamente.");
    }
  }

  const displaySlug = slugDisplay || "sua-loja";
  const displayName = (name ?? "").trim() || "Sua Empresa";

  return (
    <div className="onboarding-content relative space-y-5">
      <div className="onboarding-split-card stagger-1">
        {/* Live preview panel */}
        <aside className="onboarding-preview-panel" aria-hidden="true">
          <p className="section-title relative z-10">Preview ao vivo</p>

          <div className="preview-browser">
            <div className="preview-browser-bar">
              <div className="preview-browser-dots">
                <span /><span /><span />
              </div>
              <span className="preview-browser-url">
                {displaySlug}.whatsagent.com.br
              </span>
            </div>
            <div className="preview-browser-body">
              <div className={`preview-avatar${getInitial(name) ? "" : " preview-avatar-empty"}`}>
                {getInitial(name) ?? <Building2 className="w-4 h-4" />}
              </div>
              <p className="preview-store-name">{displayName}</p>
              <span className="preview-badge">Catálogo WhatsApp</span>
            </div>
          </div>

          <p className="preview-caption">
            Seu espaço exclusivo no WhatsAgent — painel, catálogo e link compartilhável.
          </p>
        </aside>

        {/* Form panel */}
        <div className="onboarding-form-panel">
          {/* Progress bar inside card */}
          <div className="onboarding-card-progress">
            <span className="section-title">Passo 2 de 5</span>
            <div className="prog-track h-1">
              <div className="prog-fill bg-indigo-500" style={{ width: "40%" }} />
            </div>
            <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">
              Empresa
            </span>
          </div>

          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="onboarding-form-body"
          >
            <header className="onboarding-form-header">
              <h1>Sobre sua empresa</h1>
              <p>Configure a identidade do seu espaço no WhatsAgent.</p>
            </header>

            {/* Identity section */}
            <section>
              <p className="onboarding-section-label">Identidade</p>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="company-name"
                    className="text-[13px] font-medium text-[#94a3b8] mb-1.5 block"
                  >
                    Nome da empresa <span className="text-indigo-400">*</span>
                  </label>
                  <div className="onboarding-field-wrap">
                    <Building2 className="field-icon" />
                    <input
                      id="company-name"
                      {...form.register("name")}
                      placeholder="Ex: Loja da Maria"
                      className="onboarding-input"
                      autoComplete="organization"
                    />
                  </div>
                  {form.formState.errors.name ? (
                    <p className="field-error">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {form.formState.errors.name.message}
                    </p>
                  ) : (
                    <p className="field-hint">Como seus clientes vão reconhecer sua loja.</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="company-slug"
                    className="text-[13px] font-medium text-[#94a3b8] mb-1.5 block"
                  >
                    Subdomínio único
                  </label>
                  <div className="onboarding-field-wrap">
                    <Link2 className="field-icon" />
                    <div className="onboarding-slug-group">
                      <input
                        id="company-slug"
                        value={slugDisplay}
                        readOnly
                        className="onboarding-input font-mono text-[13px] opacity-60 cursor-not-allowed"
                        spellCheck={false}
                      />
                      <span className="onboarding-slug-suffix">.whatsagent.com.br</span>
                    </div>
                  </div>
                  <p className="field-hint">
                    Definido durante o cadastro. Entre em contato para alterar.
                  </p>
                </div>
              </div>
            </section>

            {/* Regional section */}
            <section>
              <p className="onboarding-section-label">Regional</p>
              <div>
                <label
                  htmlFor="company-timezone"
                  className="text-[13px] font-medium text-[#94a3b8] mb-1.5 block"
                >
                  Fuso horário
                </label>
                <div className="onboarding-field-wrap">
                  <Clock className="field-icon" />
                  <select
                    id="company-timezone"
                    {...form.register("timezone")}
                    className="onboarding-select"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569] pointer-events-none"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <p className="field-hint">Define horários de atendimento e relatórios.</p>
              </div>
            </section>

            {/* Tip */}
            <div className="onboarding-tip">
              <Sparkles className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
              <p className="text-[12px] text-[#94a3b8] leading-relaxed">
                Você poderá alterar o nome e fuso horário depois nas configurações da conta.
              </p>
            </div>

            {apiError && (
              <p className="text-sm text-red-400 text-center">{apiError}</p>
            )}

            {/* Actions */}
            <div className="onboarding-actions">
              <div className="onboarding-actions-row">
                <Link href="/setup" className="onboarding-btn-back" aria-label="Voltar">
                  <ArrowLeft className="w-4 h-4" />
                </Link>
                <button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="onboarding-btn-primary"
                >
                  {form.formState.isSubmitting ? "Salvando…" : "Continuar"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Next step — footer integrado ao card */}
        <div className="onboarding-next-hint">
          <MessageCircle className="w-3.5 h-3.5 text-green-400" />
          <span>Próximo: conectar seu WhatsApp Business</span>
        </div>
      </div>
    </div>
  );
}
