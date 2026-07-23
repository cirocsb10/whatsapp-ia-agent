"use client";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Users, X } from "lucide-react";
import {
  SectionPanel,
  Toggle,
  FieldRow,
} from "@/features/settings/components/shared";
import {
  useChannels,
  useChannelUsers,
  useCreateChannel,
  useUpdateChannel,
  useDeleteChannel,
  useReplaceChannelMembers,
  useToggleChannelAi,
  type CreateChannelInput,
  type UpdateChannelInput,
  type WhatsappChannel,
} from "../api/queries";
import { ChannelRowMeta } from "./ChannelBadges";
import { ChannelFormDialog } from "./ChannelFormDialog";

export function ChannelsSettingsPanel() {
  const channelsQuery = useChannels();
  const usersQuery = useChannelUsers();
  const createChannel = useCreateChannel();
  const updateChannel = useUpdateChannel();
  const deleteChannel = useDeleteChannel();
  const replaceMembers = useReplaceChannelMembers();
  const toggleAi = useToggleChannelAi();

  const channels = channelsQuery.data ?? [];
  const users = usersQuery.data ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<WhatsappChannel | null>(null);
  const [membersFor, setMembersFor] = useState<WhatsappChannel | null>(null);
  const [memberDraft, setMemberDraft] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<WhatsappChannel | null>(null);

  const editInitial = useMemo(() => {
    if (!editing) return undefined;
    const initial: Partial<CreateChannelInput> & { title: string } = {
      displayName: editing.displayName,
      whatsappPhoneId: editing.whatsappPhoneId,
      isAiEnabled: editing.isAiEnabled,
      title: `Editar · ${editing.displayName}`,
    };
    if (editing.whatsappNumber) initial.whatsappNumber = editing.whatsappNumber;
    if (editing.wabaId) initial.wabaId = editing.wabaId;
    return initial;
  }, [editing]);

  const openMembers = (channel: WhatsappChannel) => {
    setMembersFor(channel);
    setMemberDraft(channel.members.map((m) => m.userId));
  };

  const handleCreate = (input: CreateChannelInput) => {
    createChannel.mutate(input, {
      onSuccess: () => setShowCreate(false),
    });
  };

  const handleEdit = (input: CreateChannelInput) => {
    if (!editing) return;
    const payload: UpdateChannelInput & { id: string } = {
      id: editing.id,
      displayName: input.displayName,
      whatsappPhoneId: input.whatsappPhoneId,
      whatsappNumber: input.whatsappNumber ?? null,
      wabaId: input.wabaId ?? null,
      isAiEnabled: input.isAiEnabled ?? false,
    };
    if (input.metaAccessToken) payload.metaAccessToken = input.metaAccessToken;
    updateChannel.mutate(payload, {
      onSuccess: () => setEditing(null),
    });
  };

  return (
    <div className="settings-tab-content">
      <SectionPanel
        title="Números conectados"
        description="Gerencie múltiplos números WhatsApp Business neste tenant. Desative a IA para operar em modo blindado (só registra)."
        accent="#22c55e"
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-[12px] text-[#64748b]">
            {channelsQuery.isLoading
              ? "Carregando…"
              : `${channels.length} número${channels.length === 1 ? "" : "s"}`}
          </p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="settings-save-btn settings-save-btn-inline inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            Adicionar número
          </button>
        </div>

        {channelsQuery.isError && (
          <p className="text-[12px] text-red-600 mb-3">
            Não foi possível carregar os canais. Tente novamente.
          </p>
        )}

        {channels.length === 0 && !channelsQuery.isLoading ? (
          <div
            className="rounded-xl px-4 py-8 text-center"
            style={{
              background: "rgba(148,163,184,0.08)",
              border: "1px dashed rgba(148,163,184,0.35)",
            }}
          >
            <p className="text-[13px] font-medium text-[#0f172a]">Nenhum número conectado</p>
            <p className="text-[11px] text-[#64748b] mt-1 max-w-sm mx-auto">
              Conecte o Phone Number ID e o access token da Meta para receber mensagens neste tenant.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {channels.map((channel) => (
              <li
                key={channel.id}
                className="rounded-xl px-3 py-3"
                style={{
                  background: "rgba(248,250,252,0.9)",
                  border: "1px solid rgba(226,232,240,0.9)",
                }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <ChannelRowMeta channel={channel} />
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-2 mr-1">
                      <span className="text-[10px] text-[#64748b] whitespace-nowrap">IA</span>
                      <Toggle
                        checked={channel.isAiEnabled}
                        onChange={(enabled) =>
                          toggleAi.mutate({ id: channel.id, enabled })
                        }
                      />
                    </div>
                    <button
                      type="button"
                      className="settings-danger-btn p-2"
                      title="Membros"
                      aria-label="Gerenciar membros"
                      onClick={() => openMembers(channel)}
                    >
                      <Users className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      className="settings-danger-btn p-2"
                      title="Editar"
                      aria-label="Editar canal"
                      onClick={() => setEditing(channel)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      className="settings-danger-btn p-2"
                      title="Remover"
                      aria-label="Remover canal"
                      onClick={() => setConfirmDelete(channel)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionPanel>

      <ChannelFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        submitting={createChannel.isPending}
        users={users}
        mode="create"
      />

      <ChannelFormDialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        onSubmit={handleEdit}
        submitting={updateChannel.isPending}
        users={users}
        mode="edit"
        {...(editInitial ? { initial: editInitial } : {})}
      />

      {membersFor && (
        <div className="settings-modal-overlay" onClick={() => setMembersFor(null)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-head">
              <div>
                <p className="settings-modal-title">Membros · {membersFor.displayName}</p>
                <p className="settings-modal-desc">
                  Agentes membros veem as conversas deste número. OWNER/ADMIN sempre veem tudo.
                </p>
              </div>
              <button
                onClick={() => setMembersFor(null)}
                className="settings-modal-close"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="settings-modal-body">
              <FieldRow label="Selecionar usuários">
                <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto w-full">
                  {users.length === 0 ? (
                    <p className="text-[12px] text-[#64748b]">Nenhum usuário ativo no tenant.</p>
                  ) : (
                    users.map((u) => (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 text-[12px] text-[#0f172a] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={memberDraft.includes(u.id)}
                          onChange={() =>
                            setMemberDraft((prev) =>
                              prev.includes(u.id)
                                ? prev.filter((id) => id !== u.id)
                                : [...prev, u.id],
                            )
                          }
                        />
                        <span>
                          {u.name}
                          <span className="text-[#94a3b8] ml-1">
                            {u.email} · {u.role}
                          </span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </FieldRow>
            </div>
            <div className="settings-modal-footer">
              <button onClick={() => setMembersFor(null)} className="settings-danger-btn">
                Cancelar
              </button>
              <button
                className="settings-save-btn settings-save-btn-inline"
                disabled={replaceMembers.isPending}
                onClick={() =>
                  replaceMembers.mutate(
                    { id: membersFor.id, userIds: memberDraft },
                    { onSuccess: () => setMembersFor(null) },
                  )
                }
              >
                {replaceMembers.isPending ? "Salvando…" : "Salvar membros"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="settings-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-head">
              <div>
                <p className="settings-modal-title">Remover número?</p>
                <p className="settings-modal-desc">
                  Isso desconecta <strong>{confirmDelete.displayName}</strong> (
                  {confirmDelete.whatsappPhoneId}). Conversas históricas permanecem.
                </p>
              </div>
              <button
                onClick={() => setConfirmDelete(null)}
                className="settings-modal-close"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="settings-modal-footer">
              <button onClick={() => setConfirmDelete(null)} className="settings-danger-btn">
                Cancelar
              </button>
              <button
                className="settings-save-btn settings-save-btn-inline"
                style={{ background: "#dc2626" }}
                disabled={deleteChannel.isPending}
                onClick={() =>
                  deleteChannel.mutate(confirmDelete.id, {
                    onSuccess: () => setConfirmDelete(null),
                  })
                }
              >
                {deleteChannel.isPending ? "Removendo…" : "Remover"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
