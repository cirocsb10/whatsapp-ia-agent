"use client";
import { User, AlertTriangle, Trash2, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useCompanySettings, useUpdateCompany } from "@/features/settings/api/queries";
import { useAuthContext } from "@/contexts/auth-context";
import { SectionPanel, FieldRow } from "./shared";

export function TabConta() {
  const { signOut } = useAuthContext();
  const companyQuery = useCompanySettings();
  const updateCompany = useUpdateCompany();
  const [name, setName] = useState("Minha Loja");
  const [email] = useState("contato@minhaloja.com");
  const [slug, setSlug] = useState("minhaloja");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [segment, setSegment] = useState("ecommerce");
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const data = companyQuery.data;
    if (!data || hydrated) return;
    setName(data.name ?? "Minha Loja");
    setSlug(data.slug ?? "minhaloja");
    setTimezone(data.timezone ?? "America/Sao_Paulo");
    setSegment(data.segment ?? "ecommerce");
    setHydrated(true);
  }, [companyQuery.data, hydrated]);

  const handleSave = () => {
    updateCompany.mutate(
      { name, timezone, segment },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 1800);
        },
      },
    );
  };

  const saving = updateCompany.isPending;

  return (
    <div className="settings-tab-content">
      {/* Avatar */}
      <SectionPanel title="Perfil" description="Informações visíveis no painel e relatórios." accent="#6366f1">
        <div className="settings-avatar-row">
          <div className="settings-avatar">
            <User className="w-8 h-8 text-slate-500" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-[#0f172a]">Foto do perfil</p>
            <p className="text-[11px] text-[#64748b] mt-1">Upload de avatar em breve.</p>
          </div>
        </div>

        <div className="settings-divider" />

        <FieldRow label="Nome da loja" hint="Usado em relatórios e notificações.">
          <input className="settings-input" value={name} onChange={(e) => setName(e.target.value)} />
        </FieldRow>

        <div className="settings-divider" />

        <FieldRow label="E-mail" hint="Endereço associado à sua conta.">
          <input className="settings-input" value={email} disabled style={{ opacity: 0.5, cursor: "not-allowed" }} />
        </FieldRow>

        <div className="settings-divider" />

        <FieldRow label="Fuso horário" hint="Usado para relatórios e timestamps.">
          <select
            className="settings-input"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            <option value="America/Sao_Paulo">América/São Paulo (UTC−3)</option>
            <option value="America/Manaus">América/Manaus (UTC−4)</option>
            <option value="America/Belem">América/Belém (UTC−3)</option>
            <option value="America/Fortaleza">América/Fortaleza (UTC−3)</option>
          </select>
        </FieldRow>
      </SectionPanel>

      {/* Store */}
      <SectionPanel title="Loja" description="Dados do tenant no sistema." accent="#22c55e">
        <FieldRow label="Slug da loja" hint="Identificador único, não pode ser alterado.">
          <div className="settings-slug-wrap">
            <span className="settings-slug-prefix">whatsagent.app/</span>
            <input className="settings-input settings-slug-input" value={slug} disabled style={{ opacity: 0.5, cursor: "not-allowed" }} />
          </div>
        </FieldRow>

        <div className="settings-divider" />

        <FieldRow label="Segmento" hint="Ajuda o agente IA a adaptar o tom das respostas.">
          <select
            className="settings-input"
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
          >
            <option value="ecommerce">E-commerce / Varejo</option>
            <option value="servicos">Serviços</option>
            <option value="alimentacao">Alimentação / Delivery</option>
            <option value="moda">Moda / Beleza</option>
            <option value="tech">Tecnologia</option>
          </select>
        </FieldRow>
      </SectionPanel>

      {/* Danger zone */}
      <div className="settings-danger-zone">
        <div className="settings-danger-head">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" strokeWidth={1.8} />
          <div>
            <p className="text-[13px] font-semibold text-[#dc2626]">Zona de perigo</p>
            <p className="text-[11px] text-[#64748b] mt-0.5">Ações irreversíveis para a sua conta.</p>
          </div>
        </div>
        <div className="settings-danger-actions">
          <button
            className="settings-danger-btn"
            onClick={() => window.open("mailto:suporte@whatsagent.app?subject=Solicitar exclusão de conta", "_blank")}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Excluir conta
          </button>
          <button className="settings-danger-btn" onClick={() => void signOut()}>
            <LogOut className="w-3.5 h-3.5" />
            Encerrar sessão atual
          </button>
        </div>
      </div>

      {/* Save */}
      <div className="settings-save-bar">
        <button className="settings-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <span className="settings-save-spinner" />
              Salvando…
            </>
          ) : saved ? (
            "Salvo"
          ) : (
            "Salvar alterações"
          )}
        </button>
      </div>
    </div>
  );
}
