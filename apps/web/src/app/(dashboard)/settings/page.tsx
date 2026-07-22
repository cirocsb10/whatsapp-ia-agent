"use client";
import { Header } from "@/components/layout/Header";
import { User, Bell, Shield, Plug, CreditCard, ChevronRight } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TabConta } from "@/features/settings/components/TabConta";
import { TabNotificacoes } from "@/features/settings/components/TabNotificacoes";
import { TabSeguranca } from "@/features/settings/components/TabSeguranca";
import { TabIntegracoes } from "@/features/settings/components/TabIntegracoes";
import { TabPlano } from "@/features/settings/components/TabPlano";

type Tab = "conta" | "notificacoes" | "seguranca" | "integracoes" | "plano";

const VALID_TABS = new Set<Tab>(["conta", "notificacoes", "seguranca", "integracoes", "plano"]);

function parseTab(value: string | null): Tab {
  return value && VALID_TABS.has(value as Tab) ? (value as Tab) : "conta";
}

const TABS: {
  key: Tab;
  label: string;
  icon: React.ElementType;
  desc: string;
  accent: string;
}[] = [
  { key: "conta",        label: "Conta",        icon: User,       desc: "Perfil, loja e preferências da conta",     accent: "#6366f1" },
  { key: "notificacoes", label: "Notificações",  icon: Bell,       desc: "Alertas de conversas, pedidos e relatórios", accent: "#f59e0b" },
  { key: "seguranca",    label: "Segurança",     icon: Shield,     desc: "Senha, 2FA e sessões ativas",                accent: "#4f46e5" },
  { key: "integracoes",  label: "Integrações",   icon: Plug,       desc: "WhatsApp, pagamentos e serviços conectados", accent: "#22c55e" },
  { key: "plano",        label: "Plano",         icon: CreditCard, desc: "Assinatura, uso e histórico de pagamentos",   accent: "#06b6d4" },
];

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(() => parseTab(tabParam));

  useEffect(() => {
    setTab(parseTab(tabParam));
  }, [tabParam]);
  const activeTab = TABS.find((t) => t.key === tab)!;
  const ActiveIcon = activeTab.icon;

  const content: Record<Tab, React.ReactNode> = {
    conta:        <TabConta />,
    notificacoes: <TabNotificacoes />,
    seguranca:    <TabSeguranca />,
    integracoes:  <TabIntegracoes />,
    plano:        <TabPlano />,
  };

  return (
    <div className="fade-up flex flex-col h-screen overflow-hidden">
      <Header title="Configurações" subtitle="Gerencie sua conta, integrações e plano" />

      <div className="settings-shell">
        <nav className="settings-nav" aria-label="Seções de configuração">
          <p className="settings-nav-label">Preferências</p>
          {TABS.map(({ key, label, icon: Icon, accent }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-current={tab === key ? "page" : undefined}
              className={`settings-nav-item ${tab === key ? "settings-nav-item-active" : ""}`}
              style={{ "--nav-accent": accent } as React.CSSProperties}
            >
              <span className="settings-nav-icon">
                <Icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
              </span>
              <span className="settings-nav-text">
                <span className="settings-nav-title">{label}</span>
              </span>
              {tab === key && <ChevronRight className="w-3 h-3 ml-auto opacity-50 shrink-0" />}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          <div className="settings-content-inner">
            <div
              className="settings-hero"
              style={{ "--hero-accent": activeTab.accent } as React.CSSProperties}
            >
              <div className="settings-hero-glow settings-hero-glow-a" />
              <div className="settings-hero-glow settings-hero-glow-b" />
              <div className="settings-hero-inner">
                <div className="settings-hero-icon">
                  <ActiveIcon className="w-5 h-5" strokeWidth={1.7} />
                </div>
                <div>
                  <p className="settings-hero-eyebrow">Configurações</p>
                  <h2 className="settings-hero-title">{activeTab.label}</h2>
                  <p className="settings-hero-desc">{activeTab.desc}</p>
                </div>
              </div>
            </div>

            <div key={tab} className="settings-tab-enter">
              {content[tab]}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="fade-up flex flex-col h-screen overflow-hidden">
          <Header title="Configurações" subtitle="Gerencie sua conta, integrações e plano" />
          <div className="flex flex-1 items-center justify-center text-slate-500">Carregando…</div>
        </div>
      }
    >
      <SettingsPageContent />
    </Suspense>
  );
}
