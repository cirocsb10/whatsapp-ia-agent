"use client";
import { useEffect, useState } from "react";
import { X, Phone } from "lucide-react";
import { FieldRow } from "@/features/settings/components/shared";
import type { ChannelMemberUser, CreateChannelInput } from "../api/queries";

interface ChannelFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateChannelInput) => void;
  submitting: boolean;
  users: ChannelMemberUser[];
  initial?: Partial<CreateChannelInput> & { title?: string; submitLabel?: string };
  mode?: "create" | "edit";
}

export function ChannelFormDialog({
  open,
  onClose,
  onSubmit,
  submitting,
  users,
  initial,
  mode = "create",
}: ChannelFormDialogProps) {
  const [displayName, setDisplayName] = useState("");
  const [whatsappPhoneId, setWhatsappPhoneId] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const [memberUserIds, setMemberUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setDisplayName(initial?.displayName ?? "");
    setWhatsappPhoneId(initial?.whatsappPhoneId ?? "");
    setWhatsappNumber(initial?.whatsappNumber ?? "");
    setMetaAccessToken(initial?.metaAccessToken ?? "");
    setWabaId(initial?.wabaId ?? "");
    setIsAiEnabled(initial?.isAiEnabled ?? false);
    setMemberUserIds(initial?.memberUserIds ?? []);
  }, [open, initial]);

  if (!open) return null;

  const canSubmit = displayName.trim().length > 0 && whatsappPhoneId.trim().length > 0;

  const toggleMember = (userId: string) => {
    setMemberUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    const input: CreateChannelInput = {
      displayName: displayName.trim(),
      whatsappPhoneId: whatsappPhoneId.trim(),
      isAiEnabled,
    };
    if (whatsappNumber.trim()) input.whatsappNumber = whatsappNumber.trim();
    if (metaAccessToken.trim()) input.metaAccessToken = metaAccessToken.trim();
    if (wabaId.trim()) input.wabaId = wabaId.trim();
    if (memberUserIds.length) input.memberUserIds = memberUserIds;
    onSubmit(input);
  };

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div
        className="settings-modal"
        style={{ maxWidth: 520 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-modal-head">
          <div className="flex items-start gap-3">
            <div
              className="settings-modal-icon"
              style={{
                background: "rgba(34,197,94,0.12)",
                borderColor: "rgba(34,197,94,0.25)",
              }}
            >
              <Phone className="w-4 h-4 text-green-700" strokeWidth={1.8} />
            </div>
            <div>
              <p className="settings-modal-title">
                {initial?.title ?? (mode === "edit" ? "Editar número" : "Conectar número")}
              </p>
              <p className="settings-modal-desc">
                Credenciais manuais da Meta Cloud API (Phone Number ID, token, WABA).
              </p>
            </div>
          </div>
          <button onClick={onClose} className="settings-modal-close" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="settings-modal-body settings-modal-form" style={{ maxHeight: "60vh", overflowY: "auto" }}>
          <FieldRow label="Nome do canal" hint="Obrigatório. Ex.: Vendas Salvador, SAC SP">
            <input
              className="settings-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Vendas Salvador"
            />
          </FieldRow>
          <FieldRow label="Phone Number ID" hint="Meta for Developers → WhatsApp → Phone Numbers">
            <input
              className="settings-input"
              value={whatsappPhoneId}
              onChange={(e) => setWhatsappPhoneId(e.target.value)}
              placeholder="123456789012345"
            />
          </FieldRow>
          <FieldRow label="Número WhatsApp" hint="Opcional. Formato E.164, ex. +5571999999999">
            <input
              className="settings-input"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="+5571999999999"
            />
          </FieldRow>
          <FieldRow
            label="Access Token"
            hint={
              mode === "edit"
                ? "Deixe em branco para manter o token atual"
                : "Token permanente do Meta Business Suite"
            }
          >
            <input
              type="password"
              className="settings-input"
              value={metaAccessToken}
              onChange={(e) => setMetaAccessToken(e.target.value)}
              placeholder="EAAxxxxxxxxxxxxxxxx"
              autoComplete="off"
            />
          </FieldRow>
          <FieldRow label="WABA ID" hint="Opcional. Necessário para sync de templates/campanhas">
            <input
              className="settings-input"
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
              placeholder="1029384756"
            />
          </FieldRow>
          <FieldRow label="IA neste número" hint="Desligado = blindado (só registra mensagens)">
            <label className="flex items-center gap-2 text-[13px] text-[#0f172a] cursor-pointer">
              <input
                type="checkbox"
                checked={isAiEnabled}
                onChange={(e) => setIsAiEnabled(e.target.checked)}
              />
              Ativar respostas automáticas da IA
            </label>
          </FieldRow>
          {mode === "create" && users.length > 0 && (
            <FieldRow label="Membros" hint="Agentes que verão as conversas deste número (opcional)">
              <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                {users.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-2 text-[12px] text-[#0f172a] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={memberUserIds.includes(u.id)}
                      onChange={() => toggleMember(u.id)}
                    />
                    <span>
                      {u.name}
                      <span className="text-[#94a3b8] ml-1">({u.role})</span>
                    </span>
                  </label>
                ))}
              </div>
            </FieldRow>
          )}
        </div>

        <div className="settings-modal-footer">
          <button onClick={onClose} className="settings-danger-btn">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="settings-save-btn settings-save-btn-inline"
          >
            {submitting
              ? "Salvando…"
              : (initial?.submitLabel ?? (mode === "edit" ? "Salvar alterações" : "Conectar número"))}
          </button>
        </div>
      </div>
    </div>
  );
}
