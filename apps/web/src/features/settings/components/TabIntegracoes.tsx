"use client";
import {
  ChevronRight, CheckCircle2, ExternalLink,
  DollarSign, MessageSquare, Sparkles, CreditCard, X,
} from "lucide-react";
import { useState } from "react";
import { useCompanySettings, useUpdateWhatsapp } from "@/features/settings/api/queries";
import { SectionPanel, FieldRow } from "./shared";

export function TabIntegracoes() {
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
