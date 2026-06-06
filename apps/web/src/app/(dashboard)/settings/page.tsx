"use client";
import { Header } from "@/components/layout/Header";
import {
  User, Bell, Shield, Smartphone, Plug, CreditCard,
  Camera, ChevronRight, Check, X, AlertTriangle,
  Globe, Clock, Zap, CheckCircle2, XCircle,
  ExternalLink, Key, Trash2, LogOut, Sparkles,
  DollarSign, Package, BarChart3, ArrowUpRight,
  Mail, MessageSquare, ShoppingCart, Bot,
} from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useClerk, UserProfile } from "@clerk/nextjs";
import { useEffect, useState } from "react";

type Tab = "conta" | "notificacoes" | "seguranca" | "integracoes" | "plano";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "conta",        label: "Conta",        icon: User       },
  { key: "notificacoes", label: "Notificações",  icon: Bell       },
  { key: "seguranca",    label: "Segurança",     icon: Shield     },
  { key: "integracoes",  label: "Integrações",   icon: Plug       },
  { key: "plano",        label: "Plano",         icon: CreditCard },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`settings-toggle ${checked ? "settings-toggle-on" : ""}`}
    >
      <span className="settings-toggle-thumb" />
    </button>
  );
}

function SectionPanel({ title, description, accent, children }: {
  title: string;
  description?: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-panel" style={{ "--panel-accent": accent } as React.CSSProperties}>
      <div className="settings-panel-head">
        <div>
          <p className="settings-panel-title">{title}</p>
          {description && <p className="settings-panel-desc">{description}</p>}
        </div>
      </div>
      <div className="settings-panel-body">{children}</div>
    </div>
  );
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="settings-field-row">
      <div className="settings-field-label-wrap">
        <label className="settings-field-label">{label}</label>
        {hint && <p className="settings-field-hint">{hint}</p>}
      </div>
      <div className="settings-field-control">{children}</div>
    </div>
  );
}

/* ── Tab content components ───────────────────────────────── */

function TabConta() {
  const { apiFetch } = useApi();
  const { signOut } = useClerk();
  const [name, setName] = useState("Minha Loja");
  const [email] = useState("contato@minhaloja.com");
  const [slug, setSlug] = useState("minhaloja");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [segment, setSegment] = useState("ecommerce");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await apiFetch("/settings/company");
      if (!res.ok) return;
      const data = await res.json();
      setName(data.name ?? "Minha Loja");
      setSlug(data.slug ?? "minhaloja");
      setTimezone(data.timezone ?? "America/Sao_Paulo");
      setSegment(data.segment ?? "ecommerce");
    }
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setSaving(true);
    const res = await apiFetch("/settings/company", {
      method: "PATCH",
      body: JSON.stringify({ name, timezone, segment }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    }
  };

  return (
    <div className="settings-tab-content">
      {/* Avatar */}
      <SectionPanel title="Perfil" description="Informações visíveis no painel e relatórios." accent="#6366f1">
        <div className="settings-avatar-row">
          <div className="settings-avatar">
            <User className="w-8 h-8 text-slate-400" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-[#e2e8f0]">Foto do perfil</p>
            <p className="text-[11px] text-[#64748b] mt-1">Upload de avatar em breve.</p>
          </div>
        </div>

        <div className="settings-divider" />

        <FieldRow label="Nome da loja" hint="Usado em relatórios e notificações.">
          <input className="settings-input" value={name} onChange={(e) => setName(e.target.value)} />
        </FieldRow>

        <div className="settings-divider" />

        <FieldRow label="E-mail" hint="Endereço associado à conta Clerk.">
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
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" strokeWidth={1.8} />
          <div>
            <p className="text-[13px] font-semibold text-[#f87171]">Zona de perigo</p>
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
          <button className="settings-danger-btn" onClick={() => signOut()}>
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
          ) : (
            <>
              <Check className="w-3.5 h-3.5" />
              {saved ? "Salvo" : "Salvar alteracoes"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function TabNotificacoes() {
  const [prefs, setPrefs] = useState({
    new_message:    true,
    handoff:        true,
    order_created:  true,
    order_paid:     true,
    weekly_report:  false,
    marketing:      false,
  });

  const toggle = (k: keyof typeof prefs) => setPrefs((p) => ({ ...p, [k]: !p[k] }));

  const GROUPS = [
    {
      title: "Conversas",
      icon: MessageSquare,
      color: "#6366f1",
      bg: "rgba(99,102,241,0.1)",
      border: "rgba(99,102,241,0.2)",
      items: [
        { key: "new_message" as const, label: "Nova mensagem recebida", desc: "Quando um contato enviar uma mensagem." },
        { key: "handoff" as const,     label: "Handoff pendente",       desc: "Quando o agente solicitar atendimento humano." },
      ],
    },
    {
      title: "Pedidos",
      icon: ShoppingCart,
      color: "#22c55e",
      bg: "rgba(34,197,94,0.1)",
      border: "rgba(34,197,94,0.2)",
      items: [
        { key: "order_created" as const, label: "Pedido criado",  desc: "Quando o agente criar um novo pedido." },
        { key: "order_paid" as const,    label: "Pagamento confirmado", desc: "Quando o pagamento de um pedido for aprovado." },
      ],
    },
    {
      title: "Relatórios",
      icon: BarChart3,
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.1)",
      border: "rgba(245,158,11,0.2)",
      items: [
        { key: "weekly_report" as const, label: "Relatório semanal", desc: "Resumo de desempenho toda segunda-feira." },
        { key: "marketing" as const,     label: "Novidades e dicas",  desc: "Atualizações de produto e boas práticas." },
      ],
    },
  ];

  return (
    <div className="settings-tab-content">
      {GROUPS.map(({ title, icon: Icon, color, bg, border, items }) => (
        <SectionPanel key={title} title={title} accent={color}>
          <div className="settings-notif-group-icon" style={{ background: bg, borderColor: border }}>
            <Icon className="w-3.5 h-3.5" style={{ color }} strokeWidth={1.8} />
            <span className="text-[12px] font-semibold" style={{ color }}>{title}</span>
          </div>
          {items.map(({ key, label, desc }, i) => (
            <div key={key}>
              {i > 0 && <div className="settings-divider" />}
              <div className="settings-notif-row">
                <div>
                  <p className="text-[13px] font-medium text-[#e2e8f0]">{label}</p>
                  <p className="text-[11px] text-[#64748b] mt-0.5">{desc}</p>
                </div>
                <Toggle checked={prefs[key]} onChange={() => toggle(key)} />
              </div>
            </div>
          ))}
        </SectionPanel>
      ))}
    </div>
  );
}

function TabSeguranca() {
  const [showProfile, setShowProfile] = useState(false);

  return (
    <div className="settings-tab-content">
      <SectionPanel
        title="Senha e autenticação"
        description="Gerencie sua senha, autenticação em dois fatores e sessões ativas."
        accent="#6366f1"
      >
        <div className="settings-2fa-row">
          <div className="settings-2fa-icon">
            <Shield className="w-5 h-5 text-indigo-400" strokeWidth={1.6} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[#e2e8f0]">Segurança da conta</p>
            <p className="text-[11px] text-[#64748b] mt-0.5">
              Senha, 2FA e sessões ativas gerenciados pelo Clerk
            </p>
          </div>
          <button
            onClick={() => setShowProfile(true)}
            className="settings-save-btn"
            style={{ width: "auto", padding: "0 16px" }}
          >
            <Key className="w-3.5 h-3.5" />
            Gerenciar
          </button>
        </div>
      </SectionPanel>

      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowProfile(false)}
              className="absolute top-2 right-2 z-10 text-slate-400 hover:text-white bg-slate-900 rounded-full p-1"
            >
              <X className="w-5 h-5" />
            </button>
            <UserProfile routing="hash" />
          </div>
        </div>
      )}
    </div>
  );
}

function TabIntegracoes() {
  const { apiFetch } = useApi();
  const [company, setCompany] = useState<{ whatsappStatus: string; whatsappPhoneId: string | null } | null>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [phoneId, setPhoneId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [savingWA, setSavingWA] = useState(false);
  const [savedWA, setSavedWA] = useState(false);
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "https://api.whatsagent.app"}/webhooks/meta`;

  useEffect(() => {
    apiFetch("/settings/company").then(async (r) => {
      if (r.ok) setCompany(await r.json());
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleSaveWhatsApp = async () => {
    setSavingWA(true);
    const res = await apiFetch("/settings/whatsapp", {
      method: "PATCH",
      body: JSON.stringify({ whatsappPhoneId: phoneId, metaAccessToken: accessToken }),
    });
    setSavingWA(false);
    if (res.ok) {
      const data = await res.json();
      setSavedWA(true);
      setShowWhatsAppModal(false);
      setCompany((c) => c ? { ...c, whatsappPhoneId: data.whatsappPhoneId, whatsappStatus: data.whatsappStatus } : c);
      setTimeout(() => setSavedWA(false), 2000);
    }
  };

  const waStatus = company?.whatsappStatus ?? "DISCONNECTED";
  const isWAConnected = waStatus === "CONNECTED";

  type ConnStatus = "connected" | "disconnected" | "pending";

  const INTEGRATIONS: {
    id: string; name: string; desc: string; icon: React.ElementType;
    color: string; bg: string; border: string; status: ConnStatus; badge: string;
    onAction?: () => void; actionLabel?: string;
  }[] = [
    {
      id: "meta", name: "Meta Cloud API", desc: "Envio e recebimento via WhatsApp.",
      icon: MessageSquare, color: "#fbbf24", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.2)",
      status: isWAConnected ? "connected" : waStatus === "PENDING" ? "pending" : "disconnected",
      badge: isWAConnected ? "Conectado" : waStatus === "PENDING" ? "Pendente" : "Desconectado",
      onAction: () => { setPhoneId(company?.whatsappPhoneId ?? ""); setAccessToken(""); setShowWhatsAppModal(true); },
      actionLabel: isWAConnected ? "Gerenciar" : "Configurar",
    },
    {
      id: "openai", name: "OpenAI", desc: "Modelo de linguagem e Whisper.",
      icon: Sparkles, color: "#4ade80", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.2)",
      status: "connected", badge: "Conectado",
    },
    {
      id: "stripe", name: "Stripe", desc: "Cobrança da assinatura do plano.",
      icon: CreditCard, color: "#818cf8", bg: "rgba(99,102,241,0.1)", border: "rgba(99,102,241,0.2)",
      status: "connected", badge: "Conectado",
    },
    {
      id: "mercadopago", name: "Mercado Pago", desc: "Pagamentos Pix para seus clientes via WhatsApp.",
      icon: DollarSign, color: "#06b6d4", bg: "rgba(6,182,212,0.1)", border: "rgba(6,182,212,0.2)",
      status: "connected", badge: "Via servidor",
    },
  ];

  const statusIcon = (s: ConnStatus) => {
    if (s === "connected") return <CheckCircle2 className="w-3.5 h-3.5 text-green-400" strokeWidth={2} />;
    if (s === "pending") return <div className="w-3.5 h-3.5 rounded-full bg-amber-400/30 border border-amber-400 flex-shrink-0" />;
    return <div className="w-3.5 h-3.5 rounded-full border border-[#334155] flex-shrink-0" />;
  };

  return (
    <div className="settings-tab-content">
      <SectionPanel
        title="Serviços conectados"
        description="Gerencie as integrações externas do WhatsAgent."
        accent="#6366f1"
      >
        <div className="settings-integ-grid">
          {INTEGRATIONS.map(({ id, name, desc, icon: Icon, color, bg, border, status, badge, onAction, actionLabel }) => (
            <div key={id} className="settings-integ-card">
              <div className="settings-integ-card-top">
                <div className="settings-integ-icon" style={{ background: bg, borderColor: border }}>
                  <Icon className="w-4 h-4" style={{ color }} strokeWidth={1.8} />
                </div>
                <div className="flex items-center gap-1.5">
                  {statusIcon(status)}
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: status === "connected" ? "#4ade80" : status === "pending" ? "#fbbf24" : "#475569" }}
                  >
                    {badge}
                  </span>
                </div>
              </div>
              <p className="text-[13px] font-semibold text-[#e2e8f0] mt-3">{name}</p>
              <p className="text-[11px] text-[#64748b] mt-1 leading-relaxed">{desc}</p>
              {actionLabel && onAction && (
                <button
                  onClick={onAction}
                  className={`settings-integ-btn mt-4 ${status === "connected" ? "settings-integ-btn-connected" : ""}`}
                >
                  {actionLabel}
                  {status === "connected"
                    ? <ExternalLink className="w-3 h-3" />
                    : <ChevronRight className="w-3 h-3" />
                  }
                </button>
              )}
            </div>
          ))}
        </div>
      </SectionPanel>

      <SectionPanel title="Webhook" description="Configure este URL no painel da Meta para receber mensagens." accent="#22c55e">
        <FieldRow label="URL do webhook" hint="Configure no painel de cada serviço externo.">
          <div className="settings-webhook-wrap">
            <input
              className="settings-input settings-webhook-input"
              value={webhookUrl}
              readOnly
            />
            <button className="settings-webhook-copy" onClick={handleCopyWebhook}>
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </FieldRow>
      </SectionPanel>

      {showWhatsAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Configurar Meta Cloud API</h3>
              <button onClick={() => setShowWhatsAppModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-1">Phone Number ID</label>
                <input
                  type="text"
                  value={phoneId}
                  onChange={(e) => setPhoneId(e.target.value)}
                  placeholder="123456789012345"
                  className="settings-input w-full"
                />
                <p className="text-xs text-slate-500 mt-1">Meta for Developers → seu app → WhatsApp → Phone Numbers</p>
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Access Token</label>
                <input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="EAAxxxxxxxxxxxxxxxx"
                  className="settings-input w-full"
                />
                <p className="text-xs text-slate-500 mt-1">Token permanente gerado no Meta Business Suite</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowWhatsAppModal(false)} className="settings-danger-btn flex-1 justify-center">
                Cancelar
              </button>
              <button
                onClick={handleSaveWhatsApp}
                disabled={!phoneId || !accessToken || savingWA}
                className="settings-save-btn flex-1"
              >
                {savingWA ? "Salvando..." : savedWA ? "Salvo!" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabPlano() {
  const { apiFetch } = useApi();
  const [sub, setSub] = useState<{
    plan: string;
    status: string;
    renewalDate: string | null;
    usage: {
      conversations: { used: number; limit: number };
      orders: { used: number; limit: number };
      products: { used: number; limit: number };
    };
  } | null>(null);
  const [invoices, setInvoices] = useState<{
    id: string;
    date: string;
    amount: string;
    currency: string;
    status: string | null;
    pdfUrl: string | null;
  }[]>([]);
  const [loading, setLoading] = useState(true);

  const PLAN_PRICE: Record<string, string> = {
    STARTER: "R$ 97", GROWTH: "R$ 297", SCALE: "R$ 497", ENTERPRISE: "Sob consulta",
  };
  const PLAN_FEATURES: Record<string, string[]> = {
    STARTER: ["100 conversas/mês", "Agente IA com LangGraph", "Suporte por email"],
    GROWTH: ["Conversas ilimitadas", "Agente IA com LangGraph", "Catálogo de produtos", "Links de pagamento", "Analytics avançado", "Suporte prioritário"],
    SCALE: ["Tudo do Growth", "Multi-atendentes", "API access", "SLA garantido"],
    ENTERPRISE: ["Customizado", "Infraestrutura dedicada"],
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [subRes, histRes] = await Promise.all([
        apiFetch("/billing/subscription"),
        apiFetch("/billing/history"),
      ]);
      if (subRes.ok) setSub(await subRes.json());
      if (histRes.ok) {
        const data = await histRes.json();
        setInvoices(data.invoices ?? []);
      }
      setLoading(false);
    }
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const planName = sub?.plan ?? "STARTER";
  const planDisplay = planName.charAt(0) + planName.slice(1).toLowerCase();
  const statusLabel = sub?.status === "ACTIVE" ? "Ativo" : sub?.status === "TRIAL" ? "Trial" : sub?.status ?? "—";
  const renewalDisplay = sub?.renewalDate
    ? new Date(sub.renewalDate).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  const USAGE = [
    { label: "Conversas", key: "conversations" as const, color: "#6366f1" },
    { label: "Pedidos", key: "orders" as const, color: "#22c55e" },
    { label: "Produtos", key: "products" as const, color: "#f59e0b" },
  ];

  if (loading) {
    return (
      <div className="settings-tab-content flex items-center justify-center h-64 text-slate-400">
        Carregando...
      </div>
    );
  }

  return (
    <div className="settings-tab-content">
      <div className="settings-plan-card">
        <div className="settings-plan-glow" />
        <div className="settings-plan-header">
          <div className="settings-plan-icon">
            <Sparkles className="w-5 h-5 text-green-400" strokeWidth={1.6} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#4ade80] uppercase tracking-widest">Plano atual</p>
            <p className="text-[22px] font-bold text-[#f1f5f9] leading-tight mt-0.5 tracking-tight">{planDisplay}</p>
          </div>
          <span className={`tag ml-auto shrink-0 ${sub?.status === "ACTIVE" ? "tag-green" : "tag-slate"}`}>
            {statusLabel}
          </span>
        </div>

        <div className="settings-plan-price">
          <span className="text-[32px] font-bold text-[#f1f5f9] tracking-tight">{PLAN_PRICE[planName] ?? "—"}</span>
          {planName !== "ENTERPRISE" && <span className="text-[13px] text-[#64748b]">/mês</span>}
        </div>

        <ul className="settings-plan-features">
          {(PLAN_FEATURES[planName] ?? []).map((f) => (
            <li key={f} className="flex items-center gap-2 text-[12px] text-[#94a3b8]">
              <Check className="w-3 h-3 text-green-400 shrink-0" strokeWidth={2.5} />
              {f}
            </li>
          ))}
        </ul>

        <div className="settings-plan-footer">
          <p className="text-[11px] text-[#475569]">
            Próxima renovação: <span className="text-[#94a3b8]">{renewalDisplay}</span>
          </p>
          <button className="settings-plan-upgrade-btn">
            <ArrowUpRight className="w-3.5 h-3.5" />
            Ver planos
          </button>
        </div>
      </div>

      <SectionPanel title="Uso do mês" description="Consumo atual do seu plano." accent="#22c55e">
        <div className="settings-usage-list">
          {USAGE.map(({ label, key, color }) => {
            const u = sub?.usage[key] ?? { used: 0, limit: 1 };
            const pct = Math.min(Math.round((u.used / u.limit) * 100), 100);
            return (
              <div key={key} className="settings-usage-row">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-medium text-[#94a3b8]">{label}</span>
                  <span className="text-[11px] text-[#475569] font-variant-numeric tabular-nums">
                    {u.used} / {u.limit}
                  </span>
                </div>
                <div className="prog-track">
                  <div className="prog-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>
      </SectionPanel>

      <SectionPanel title="Histórico de pagamentos" accent="#6366f1">
        {invoices.length === 0 ? (
          <div className="settings-billing-empty">
            <CreditCard className="w-5 h-5 text-[#334155]" strokeWidth={1.5} />
            <p className="text-[12px] text-[#475569]">Nenhum pagamento registrado ainda.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                <div>
                  <p className="text-sm text-white">{new Date(inv.date).toLocaleDateString("pt-BR")}</p>
                  <p className="text-xs text-slate-500">{inv.status}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-white">{inv.currency} {inv.amount}</span>
                  {inv.pdfUrl && (
                    <a href={inv.pdfUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionPanel>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────── */

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("conta");

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
        {/* Left nav */}
        <nav className="settings-nav">
          <p className="section-title px-3 mb-2">Menu</p>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`settings-nav-item ${tab === key ? "settings-nav-item-active" : ""}`}
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
              {label}
              {tab === key && <ChevronRight className="w-3 h-3 ml-auto opacity-40" />}
            </button>
          ))}
        </nav>

        {/* Right content */}
        <div className="settings-content">
          {content[tab]}
        </div>
      </div>
    </div>
  );
}
