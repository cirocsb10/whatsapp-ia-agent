"use client";

import { useMemo, useState } from "react";
import { Loader2, Megaphone, RefreshCw, Send } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { useChannels } from "@/features/channels/api/queries";
import { useStages } from "@/features/crm/api/queries";
import {
  useCampaign,
  useCampaigns,
  useCreateCampaign,
  useDispatchCampaign,
  useMessageTemplates,
  useSyncTemplates,
  type AudienceQuery,
  type CampaignListItem,
  type CampaignRecipientStatus,
  type MessageTemplateStatus,
} from "@/features/campaigns/api/queries";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendada",
  SENDING: "Enviando",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
  FAILED: "Falhou",
  PENDING: "Pendente",
  SENT: "Enviada",
  DELIVERED: "Entregue",
  READ: "Lida",
  SKIPPED: "Ignorada",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  PAUSED: "Pausado",
  DISABLED: "Desativado",
};

function statusBadge(status: string) {
  const tone =
    status === "APPROVED" || status === "DELIVERED" || status === "READ" || status === "COMPLETED"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "FAILED" || status === "REJECTED"
        ? "bg-red-50 text-red-700 border-red-200"
        : status === "SENDING" || status === "SENT" || status === "PENDING"
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-slate-50 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium border ${tone}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export default function CampaignsPage() {
  const channelsQuery = useChannels();
  const stagesQuery = useStages();
  const campaignsQuery = useCampaigns();
  const syncTemplates = useSyncTemplates();
  const createCampaign = useCreateCampaign();
  const dispatchCampaign = useDispatchCampaign();

  const channels = channelsQuery.data ?? [];
  const stages = stagesQuery.data ?? [];
  const campaigns = campaignsQuery.data ?? [];

  const [syncChannelId, setSyncChannelId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailQuery = useCampaign(selectedId);

  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [audienceType, setAudienceType] = useState<"all" | "crm_stage">("all");
  const [stageId, setStageId] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const approvedTemplatesQuery = useMessageTemplates(channelId || undefined, true);
  const allTemplatesQuery = useMessageTemplates(syncChannelId || undefined, false);

  const approvedTemplates = approvedTemplatesQuery.data ?? [];
  const syncedTemplates = allTemplatesQuery.data ?? [];

  const effectiveSyncChannel = syncChannelId || channels[0]?.id || "";

  const recipientCounts = useMemo(() => {
    const list = detailQuery.data?.recipients ?? [];
    const counts: Partial<Record<CampaignRecipientStatus, number>> = {};
    for (const r of list) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    }
    return counts;
  }, [detailQuery.data?.recipients]);

  async function handleSync() {
    const id = effectiveSyncChannel;
    if (!id) {
      setError("Selecione um canal com wabaId e token Meta.");
      return;
    }
    setError(null);
    try {
      await syncTemplates.mutateAsync(id);
      setSyncChannelId(id);
      setToast("Templates sincronizados da Meta.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao sincronizar templates");
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !channelId || !templateId) {
      setError("Preencha nome, canal e template.");
      return;
    }
    const audienceQuery: AudienceQuery =
      audienceType === "all"
        ? { type: "all" }
        : { type: "crm_stage", stageId };
    if (audienceType === "crm_stage" && !stageId) {
      setError("Selecione o estágio do CRM.");
      return;
    }
    try {
      const created = await createCampaign.mutateAsync({
        name: name.trim(),
        channelId,
        templateId,
        audienceQuery,
      });
      setToast("Campanha criada como rascunho.");
      setName("");
      setTemplateId("");
      setSelectedId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar campanha");
    }
  }

  async function handleDispatch(id: string) {
    setError(null);
    try {
      await dispatchCampaign.mutateAsync(id);
      setSelectedId(id);
      setToast("Disparo enfileirado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao disparar");
    }
  }

  return (
    <div className="min-h-full">
      <Header
        title="Campanhas"
        subtitle="Templates Meta aprovados · audiência com opt-out · rastreio de entrega"
      />

      <div className="p-6 space-y-6 max-w-6xl">
        {(toast || error) && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              error
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}
          >
            {error ?? toast}
            <button
              type="button"
              className="ml-3 underline text-xs"
              onClick={() => {
                setToast(null);
                setError(null);
              }}
            >
              fechar
            </button>
          </div>
        )}

        {/* Templates sync */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-indigo-500" />
                Templates Meta
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Sincronize pela Business Management API (wabaId + token do canal). Só templates{" "}
                <strong>APPROVED</strong> entram no disparo.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
                value={effectiveSyncChannel}
                onChange={(e) => setSyncChannelId(e.target.value)}
              >
                {channels.length === 0 && <option value="">Nenhum canal</option>}
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleSync()}
                disabled={syncTemplates.isPending || !effectiveSyncChannel}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 text-white text-sm px-3 py-2 hover:bg-indigo-500 disabled:opacity-50"
              >
                {syncTemplates.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Sincronizar
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="py-2 font-medium">Nome</th>
                  <th className="py-2 font-medium">Idioma</th>
                  <th className="py-2 font-medium">Categoria</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {syncedTemplates.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400 text-xs">
                      Nenhum template — escolha um canal e sincronize.
                    </td>
                  </tr>
                )}
                {syncedTemplates.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50">
                    <td className="py-2.5 font-medium text-slate-800">{t.name}</td>
                    <td className="py-2.5 text-slate-600">{t.language}</td>
                    <td className="py-2.5 text-slate-600">{t.category ?? "—"}</td>
                    <td className="py-2.5">{statusBadge(t.status as MessageTemplateStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Builder */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-1">Nova campanha</h2>
          <p className="text-xs text-slate-500 mb-4">
            Contatos com opt-out são excluídos na montagem da audiência.
          </p>
          <form onSubmit={(e) => void handleCreate(e)} className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs text-slate-600 space-y-1 sm:col-span-2">
              Nome
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Aniversário Salvador 2026"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-slate-600 space-y-1">
              Canal
              <select
                value={channelId}
                onChange={(e) => {
                  setChannelId(e.target.value);
                  setTemplateId("");
                }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Selecione…</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-600 space-y-1">
              Template (APPROVED)
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                disabled={!channelId}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-50"
              >
                <option value="">Selecione…</option>
                {approvedTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.language})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-600 space-y-1">
              Audiência
              <select
                value={audienceType}
                onChange={(e) => setAudienceType(e.target.value as "all" | "crm_stage")}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="all">Todos os contatos (sem opt-out)</option>
                <option value="crm_stage">Estágio do CRM</option>
              </select>
            </label>
            {audienceType === "crm_stage" && (
              <label className="block text-xs text-slate-600 space-y-1">
                Estágio
                <select
                  value={stageId}
                  onChange={(e) => setStageId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="">Selecione…</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={createCampaign.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 text-white text-sm px-4 py-2 hover:bg-emerald-500 disabled:opacity-50"
              >
                {createCampaign.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Criar rascunho
              </button>
            </div>
          </form>
        </section>

        {/* History */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Histórico</h2>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              {campaignsQuery.isPending && (
                <p className="text-xs text-slate-400">Carregando…</p>
              )}
              {!campaignsQuery.isPending && campaigns.length === 0 && (
                <p className="text-xs text-slate-400">Nenhuma campanha ainda.</p>
              )}
              {campaigns.map((c) => (
                <CampaignRow
                  key={c.id}
                  campaign={c}
                  selected={selectedId === c.id}
                  onSelect={() => setSelectedId(c.id)}
                  onDispatch={() => void handleDispatch(c.id)}
                  dispatching={dispatchCampaign.isPending}
                />
              ))}
            </div>

            <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4 min-h-[200px]">
              {!selectedId && (
                <p className="text-xs text-slate-400">Selecione uma campanha para ver destinatários.</p>
              )}
              {selectedId && detailQuery.isPending && (
                <p className="text-xs text-slate-400">Carregando detalhe…</p>
              )}
              {detailQuery.data && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">{detailQuery.data.name}</p>
                    {statusBadge(detailQuery.data.status)}
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                    {Object.entries(recipientCounts).map(([k, v]) => (
                      <span key={k} className="px-2 py-0.5 rounded bg-white border border-slate-200">
                        {STATUS_LABEL[k] ?? k}: {v}
                      </span>
                    ))}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-500 border-b border-slate-200">
                          <th className="py-1.5 font-medium">Contato</th>
                          <th className="py-1.5 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailQuery.data.recipients.map((r) => (
                          <tr key={r.id} className="border-b border-slate-100">
                            <td className="py-2">
                              <div className="font-medium text-slate-700">
                                {r.contact.name ?? "—"}
                              </div>
                              <div className="text-slate-400">{r.contact.phone}</div>
                              {r.failureReason && (
                                <div className="text-red-500 mt-0.5">{r.failureReason}</div>
                              )}
                            </td>
                            <td className="py-2 align-top">{statusBadge(r.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function CampaignRow({
  campaign,
  selected,
  onSelect,
  onDispatch,
  dispatching,
}: {
  campaign: CampaignListItem;
  selected: boolean;
  onSelect: () => void;
  onDispatch: () => void;
  dispatching: boolean;
}) {
  const canDispatch = campaign.status === "DRAFT" || campaign.status === "SCHEDULED";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`w-full text-left rounded-lg border px-3 py-3 transition cursor-pointer ${
        selected
          ? "border-indigo-300 bg-indigo-50/50"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-800">{campaign.name}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {campaign.channel.displayName} · {campaign.template.name} ·{" "}
            {campaign._count.recipients} destinatários
          </p>
        </div>
        {statusBadge(campaign.status)}
      </div>
      {canDispatch && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDispatch();
          }}
          disabled={dispatching}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50"
        >
          {dispatching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          Disparar agora
        </button>
      )}
    </div>
  );
}
