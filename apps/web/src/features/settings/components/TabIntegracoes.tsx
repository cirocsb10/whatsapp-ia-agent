"use client";
import {
  ChevronRight, CheckCircle2, ExternalLink,
  DollarSign, MessageSquare, Sparkles, CreditCard,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCompanySettings } from "@/features/settings/api/queries";
import { SectionPanel, FieldRow } from "./shared";

export function TabIntegracoes() {
  const router = useRouter();
  const companyQuery = useCompanySettings();
  const company = companyQuery.data ?? null;
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "https://api.whatsagent.app"}/webhooks/meta`;

  const handleCopyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
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
      id: "meta", name: "Meta Cloud API", desc: "Envio e recebimento via WhatsApp. Gerencie múltiplos números na aba Números.",
      icon: MessageSquare, color: "#fbbf24", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.2)",
      status: isWAConnected ? "connected" : waStatus === "PENDING" ? "pending" : "disconnected",
      badge: isWAConnected ? "Conectado" : waStatus === "PENDING" ? "Pendente" : "Desconectado",
      onAction: () => router.push("/settings?tab=numeros"),
      actionLabel: isWAConnected ? "Gerenciar números" : "Conectar números",
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
    </div>
  );
}
