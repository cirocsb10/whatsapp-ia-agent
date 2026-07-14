"use client";
import { Header } from "@/components/layout/Header";
import {
  User, Bell, Shield, Plug, CreditCard,
  ChevronRight, Check, X, AlertTriangle,
  CheckCircle2,
  ExternalLink, Key, Trash2, LogOut, Sparkles,
  DollarSign, BarChart3, ArrowUpRight,
  MessageSquare, ShoppingCart,
} from "lucide-react";
import {
  useBillingHistory,
  useBillingSubscription,
  useChangePassword,
  useCompanySettings,
  useNotificationPrefs,
  useUpdateCompany,
  useUpdateNotifications,
  useUpdateWhatsapp,
} from "@/features/settings/api/queries";
import { useAuthContext } from "@/contexts/auth-context";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

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
    <div className="settings-panel" style={{ "--panel-accent": accent ?? "#6366f1" } as React.CSSProperties}>
      <div className="settings-panel-accent-bar" />
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

type NotifPrefs = {
  newMessage: boolean;
  handoffPending: boolean;
  orderCreated: boolean;
  paymentConfirmed: boolean;
  weeklyReport: boolean;
  productUpdates: boolean;
};

const DEFAULT_PREFS: NotifPrefs = {
  newMessage: true,
  handoffPending: true,
  orderCreated: true,
  paymentConfirmed: true,
  weeklyReport: false,
  productUpdates: false,
};

function TabNotificacoes() {
  const prefsQuery = useNotificationPrefs();
  const updateNotifications = useUpdateNotifications();
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const data = prefsQuery.data;
    if (!data || hydrated) return;
    setPrefs({ ...DEFAULT_PREFS, ...data });
    setHydrated(true);
  }, [prefsQuery.data, hydrated]);

  const toggle = (key: keyof NotifPrefs) =>
    setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = () => {
    updateNotifications.mutate(prefs, {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      },
    });
  };

  const saving = updateNotifications.isPending;

  const GROUPS = [
    {
      title: "Conversas",
      icon: MessageSquare,
      color: "#6366f1",
      bg: "rgba(99,102,241,0.1)",
      border: "rgba(99,102,241,0.2)",
      items: [
        { key: "newMessage" as const, label: "Nova mensagem recebida", desc: "Quando um contato enviar uma mensagem." },
        { key: "handoffPending" as const, label: "Handoff pendente", desc: "Quando o agente solicitar atendimento humano." },
      ],
    },
    {
      title: "Pedidos",
      icon: ShoppingCart,
      color: "#22c55e",
      bg: "rgba(34,197,94,0.1)",
      border: "rgba(34,197,94,0.2)",
      items: [
        { key: "orderCreated" as const, label: "Pedido criado", desc: "Quando o agente criar um novo pedido." },
        { key: "paymentConfirmed" as const, label: "Pagamento confirmado", desc: "Quando o pagamento de um pedido for aprovado." },
      ],
    },
    {
      title: "Relatórios",
      icon: BarChart3,
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.1)",
      border: "rgba(245,158,11,0.2)",
      items: [
        { key: "weeklyReport" as const, label: "Relatório semanal", desc: "Resumo de desempenho toda segunda-feira." },
        { key: "productUpdates" as const, label: "Novidades e dicas", desc: "Atualizações de produto e boas práticas." },
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
                  <p className="text-[13px] font-medium text-[#0f172a]">{label}</p>
                  <p className="text-[11px] text-[#64748b] mt-0.5">{desc}</p>
                </div>
                <Toggle checked={prefs[key]} onChange={() => toggle(key)} />
              </div>
            </div>
          ))}
        </SectionPanel>
      ))}

      <div className="settings-save-bar">
        <button className="settings-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <span className="settings-save-spinner" />
              Salvando…
            </>
          ) : saved ? (
            "Salvo!"
          ) : (
            "Salvar preferências"
          )}
        </button>
      </div>
    </div>
  );
}

function TabSeguranca() {
  const changePassword = useChangePassword();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setSuccess(true);
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          setTimeout(() => {
            setSuccess(false);
            setShowPasswordModal(false);
          }, 1500);
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : "Não foi possível alterar a senha");
        },
      },
    );
  }

  const saving = changePassword.isPending;

  return (
    <div className="settings-tab-content">
      <SectionPanel
        title="Senha e autenticação"
        description="Gerencie sua senha e sessões ativas."
        accent="#6366f1"
      >
        <div className="settings-2fa-row">
          <div className="settings-2fa-icon">
            <Shield className="w-5 h-5 text-indigo-600" strokeWidth={1.6} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[#0f172a]">Alterar senha</p>
            <p className="text-[11px] text-[#64748b] mt-0.5">
              Atualize sua senha de acesso ao painel
            </p>
          </div>
          <button
            onClick={() => setShowPasswordModal(true)}
            className="settings-save-btn"
            style={{ width: "auto", padding: "0 16px" }}
          >
            <Key className="w-3.5 h-3.5" />
            Alterar
          </button>
        </div>
      </SectionPanel>

      {showPasswordModal && (
        <div className="settings-modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-head">
              <div>
                <p className="settings-modal-title">Alterar senha</p>
                <p className="settings-modal-desc">Use uma senha forte com pelo menos 8 caracteres</p>
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="settings-modal-close"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form className="settings-modal-body space-y-4" onSubmit={(e) => void handleChangePassword(e)}>
              <FieldRow label="Senha atual">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="settings-input"
                  required
                />
              </FieldRow>
              <FieldRow label="Nova senha">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="settings-input"
                  minLength={8}
                  required
                />
              </FieldRow>
              <FieldRow label="Confirmar nova senha">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="settings-input"
                  minLength={8}
                  required
                />
              </FieldRow>
              {error && <p className="text-sm text-rose-600">{error}</p>}
              {success && <p className="text-sm text-green-600">Senha alterada com sucesso!</p>}
              <button type="submit" className="settings-save-btn" disabled={saving}>
                {saving ? "Salvando..." : "Salvar nova senha"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TabIntegracoes() {
  const companyQuery = useCompanySettings();
  const updateWhatsapp = useUpdateWhatsapp();
  const company = companyQuery.data ?? null;
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [phoneId, setPhoneId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [savedWA, setSavedWA] = useState(false);
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "https://api.whatsagent.app"}/webhooks/meta`;

  const handleCopyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleSaveWhatsApp = () => {
    updateWhatsapp.mutate(
      { whatsappPhoneId: phoneId, metaAccessToken: accessToken },
      {
        onSuccess: () => {
          setSavedWA(true);
          setShowWhatsAppModal(false);
          setTimeout(() => setSavedWA(false), 2000);
        },
      },
    );
  };

  const savingWA = updateWhatsapp.isPending;
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
    if (s === "connected") return <CheckCircle2 className="w-3.5 h-3.5 text-green-600" strokeWidth={2} />;
    if (s === "pending") return <div className="w-3.5 h-3.5 rounded-full bg-amber-400/30 border border-amber-400 flex-shrink-0" />;
    return <div className="w-3.5 h-3.5 rounded-full border border-[#cbd5e1] flex-shrink-0" />;
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
                <div className="settings-integ-status">
                  {statusIcon(status)}
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: status === "connected" ? "#15803d" : status === "pending" ? "#a16207" : "#94a3b8" }}
                  >
                    {badge}
                  </span>
                </div>
              </div>
              <p className="text-[13px] font-semibold text-[#0f172a] mt-3">{name}</p>
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
        <div className="settings-modal-overlay" onClick={() => setShowWhatsAppModal(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-head">
              <div className="flex items-start gap-3">
                <div className="settings-modal-icon" style={{ background: "rgba(251,191,36,0.12)", borderColor: "rgba(251,191,36,0.25)" }}>
                  <MessageSquare className="w-4 h-4 text-amber-700" strokeWidth={1.8} />
                </div>
                <div>
                  <p className="settings-modal-title">Configurar Meta Cloud API</p>
                  <p className="settings-modal-desc">Conecte seu número WhatsApp Business</p>
                </div>
              </div>
              <button onClick={() => setShowWhatsAppModal(false)} className="settings-modal-close" aria-label="Fechar">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="settings-modal-body settings-modal-form">
              <FieldRow label="Phone Number ID" hint="Meta for Developers → WhatsApp → Phone Numbers">
                <input
                  type="text"
                  value={phoneId}
                  onChange={(e) => setPhoneId(e.target.value)}
                  placeholder="123456789012345"
                  className="settings-input"
                />
              </FieldRow>
              <FieldRow label="Access Token" hint="Token permanente do Meta Business Suite">
                <input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="EAAxxxxxxxxxxxxxxxx"
                  className="settings-input"
                />
              </FieldRow>
            </div>
            <div className="settings-modal-footer">
              <button onClick={() => setShowWhatsAppModal(false)} className="settings-danger-btn">
                Cancelar
              </button>
              <button
                onClick={handleSaveWhatsApp}
                disabled={!phoneId || !accessToken || savingWA}
                className="settings-save-btn settings-save-btn-inline"
              >
                {savingWA ? "Salvando…" : savedWA ? "Salvo!" : "Salvar conexão"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabPlano() {
  const subQuery = useBillingSubscription();
  const historyQuery = useBillingHistory();
  const sub = subQuery.data ?? null;
  const invoices = historyQuery.data?.invoices ?? [];
  const loading = subQuery.isPending || historyQuery.isPending;

  const PLAN_PRICE: Record<string, string> = {
    STARTER: "R$ 97", GROWTH: "R$ 297", SCALE: "R$ 497", ENTERPRISE: "Sob consulta",
  };
  const PLAN_FEATURES: Record<string, string[]> = {
    STARTER: ["100 conversas/mês", "Agente IA com LangGraph", "Suporte por email"],
    GROWTH: ["Conversas ilimitadas", "Agente IA com LangGraph", "Catálogo de produtos", "Links de pagamento", "Analytics avançado", "Suporte prioritário"],
    SCALE: ["Tudo do Growth", "Multi-atendentes", "API access", "SLA garantido"],
    ENTERPRISE: ["Customizado", "Infraestrutura dedicada"],
  };

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
      <div className="settings-tab-content">
        <div className="settings-loading">
          <span className="settings-save-spinner" />
          <p>Carregando informações do plano…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-tab-content">
      <div className="settings-plan-card">
        <div className="settings-plan-glow" />
        <div className="settings-plan-header">
          <div className="settings-plan-icon">
            <Sparkles className="w-5 h-5 text-green-600" strokeWidth={1.6} />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#15803d] uppercase tracking-widest">Plano atual</p>
            <p className="text-[22px] font-bold text-[#0f172a] leading-tight mt-0.5 tracking-tight">{planDisplay}</p>
          </div>
          <span className={`tag ml-auto shrink-0 ${sub?.status === "ACTIVE" ? "tag-green" : "tag-slate"}`}>
            {statusLabel}
          </span>
        </div>

        <div className="settings-plan-price">
          <span className="text-[32px] font-bold text-[#0f172a] tracking-tight">{PLAN_PRICE[planName] ?? "—"}</span>
          {planName !== "ENTERPRISE" && <span className="text-[13px] text-[#64748b]">/mês</span>}
        </div>

        <ul className="settings-plan-features">
          {(PLAN_FEATURES[planName] ?? []).map((f) => (
            <li key={f} className="flex items-center gap-2 text-[12px] text-[#64748b]">
              <Check className="w-3 h-3 text-green-600 shrink-0" strokeWidth={2.5} />
              {f}
            </li>
          ))}
        </ul>

        <div className="settings-plan-footer">
          <p className="text-[11px] text-[#94a3b8]">
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
                  <span className="text-[11px] text-[#94a3b8] font-variant-numeric tabular-nums">
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
            <CreditCard className="w-5 h-5 text-[#94a3b8]" strokeWidth={1.5} />
            <p className="text-[12px] text-[#94a3b8]">Nenhum pagamento registrado ainda.</p>
          </div>
        ) : (
          <div className="settings-invoice-list">
            {invoices.map((inv) => (
              <div key={inv.id} className="settings-invoice-row">
                <div className="settings-invoice-date">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-600 shrink-0" strokeWidth={1.8} />
                  <div>
                    <p className="text-[13px] font-medium text-[#0f172a]">
                      {new Date(inv.date).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <p className="text-[11px] text-[#64748b] mt-0.5">{inv.status ?? "Processado"}</p>
                  </div>
                </div>
                <div className="settings-invoice-meta">
                  <span className="settings-invoice-amount">{inv.currency} {inv.amount}</span>
                  {inv.pdfUrl && (
                    <a href={inv.pdfUrl} target="_blank" rel="noreferrer" className="settings-invoice-link" aria-label="Baixar fatura">
                      <ExternalLink className="w-3.5 h-3.5" />
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
