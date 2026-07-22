"use client";
import { Check, CreditCard, Sparkles, ArrowUpRight, ExternalLink } from "lucide-react";
import { useBillingHistory, useBillingSubscription } from "@/features/settings/api/queries";
import { SectionPanel } from "./shared";

const PLAN_PRICE: Record<string, string> = {
  STARTER: "R$ 97", GROWTH: "R$ 297", SCALE: "R$ 497", ENTERPRISE: "Sob consulta",
};
const PLAN_FEATURES: Record<string, string[]> = {
  STARTER: ["100 conversas/mês", "Agente IA com LangGraph", "Suporte por email"],
  GROWTH: ["Conversas ilimitadas", "Agente IA com LangGraph", "Catálogo de produtos", "Links de pagamento", "Analytics avançado", "Suporte prioritário"],
  SCALE: ["Tudo do Growth", "Multi-atendentes", "API access", "SLA garantido"],
  ENTERPRISE: ["Customizado", "Infraestrutura dedicada"],
};

export function TabPlano() {
  const subQuery = useBillingSubscription();
  const historyQuery = useBillingHistory();
  const sub = subQuery.data ?? null;
  const invoices = historyQuery.data?.invoices ?? [];
  const loading = subQuery.isPending || historyQuery.isPending;

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
