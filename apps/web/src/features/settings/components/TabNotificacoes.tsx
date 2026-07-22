"use client";
import { BarChart3, MessageSquare, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { useNotificationPrefs, useUpdateNotifications } from "@/features/settings/api/queries";
import { SectionPanel, Toggle } from "./shared";

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

export function TabNotificacoes() {
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
