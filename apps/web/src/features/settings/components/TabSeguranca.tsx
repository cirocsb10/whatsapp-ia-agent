"use client";
import { Shield, Key, X } from "lucide-react";
import { useState } from "react";
import { useChangePassword } from "@/features/settings/api/queries";
import { SectionPanel, FieldRow } from "./shared";

export function TabSeguranca() {
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
