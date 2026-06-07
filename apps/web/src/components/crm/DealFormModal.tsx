"use client";

import { useCallback, useEffect, useState } from "react";
import { Kanban } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/FormSelect";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { useApi } from "@/lib/hooks/useApi";
import { useCrmStore } from "@/lib/store/crm.store";
import { Deal, ContactSearchResult } from "@/types/crm";
import { centsToMaskedPrice, maskedPriceToCents } from "@/lib/decimal-mask";

interface Props {
  open:             boolean;
  onClose:          () => void;
  onSaved:          () => void;
  deal?:            Deal | null;
  initialStageId?:  string;
}

interface FormState {
  title:      string;
  stageId:    string;
  valueReais: string;
  notes:      string;
  contactId:  string;
}

const EMPTY: FormState = { title: "", stageId: "", valueReais: "", notes: "", contactId: "" };

function dealToForm(d: Deal): FormState {
  return {
    title:      d.title,
    stageId:    d.stageId,
    valueReais: d.valueCents > 0 ? centsToMaskedPrice(d.valueCents) : "",
    notes:      d.notes ?? "",
    contactId:  d.contactId ?? "",
  };
}

export function DealFormModal({ open, onClose, onSaved, deal, initialStageId }: Props) {
  const { apiFetch } = useApi();
  const stages     = useCrmStore((s) => s.stages);
  const addDeal    = useCrmStore((s) => s.addDeal);
  const updateDeal = useCrmStore((s) => s.updateDeal);

  const [form,          setForm]          = useState<FormState>(EMPTY);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [contacts,      setContacts]      = useState<ContactSearchResult[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [contactLoading, setContactLoading] = useState(false);

  const isEditing = !!deal;

  useEffect(() => {
    if (!open) return;
    const base = deal
      ? dealToForm(deal)
      : { ...EMPTY, stageId: initialStageId ?? stages[0]?.id ?? "" };
    setForm(base);
    setError(null);
    setContactSearch("");
    if (deal?.contact) {
      setContacts([{ id: deal.contact.id, name: deal.contact.name, phone: deal.contact.phone }]);
    } else {
      setContacts([]);
    }
  }, [open, deal, initialStageId, stages]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      setContactLoading(true);
      try {
        const res = await apiFetch(`/crm/contacts/search?q=${encodeURIComponent(contactSearch)}`);
        if (res.ok) setContacts(await res.json());
      } finally {
        setContactLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [contactSearch, open, apiFetch]);

  const setField = useCallback(<K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [field]: value }));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.stageId) {
      setError("Título e etapa são obrigatórios.");
      return;
    }
    setSaving(true);
    setError(null);

    const valueCents = form.valueReais.trim() ? (maskedPriceToCents(form.valueReais) ?? 0) : 0;
    const body = {
      title:     form.title.trim(),
      stageId:   form.stageId,
      valueCents,
      notes:     form.notes.trim() || undefined,
      contactId: form.contactId || undefined,
    };

    try {
      const res = await apiFetch(
        isEditing ? `/crm/deals/${deal!.id}` : "/crm/deals",
        { method: isEditing ? "PUT" : "POST", body: JSON.stringify(body) },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { message?: string })?.message ?? "Erro ao salvar negócio.");
      }
      const saved: Deal = await res.json();
      isEditing ? updateDeal(saved) : addDeal(saved);
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const stageOptions = stages.map((s) => ({ value: s.id, label: s.name, color: s.color }));
  const contactOptions = [
    { value: "", label: "Nenhum contato" },
    ...contacts.map((c) => ({
      value: c.id,
      label: c.name ? `${c.name} (${c.phone})` : c.phone,
    })),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Editar negócio" : "Novo negócio"}
      subtitle={isEditing ? `Editando: ${deal?.title}` : "Preencha os dados do negócio"}
      size="md"
      headerLeading={<Kanban className="w-5 h-5 text-indigo-400" />}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button
            form="deal-form"
            type="submit"
            disabled={saving || !form.title.trim() || !form.stageId}
            className="catalog-add-btn"
            style={{ minWidth: 120 }}
          >
            {saving ? "Salvando…" : isEditing ? "Salvar" : "Adicionar"}
          </button>
        </>
      }
    >
      <form id="deal-form" onSubmit={handleSubmit}>
        <div className="form-grid-2">
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">Título *</label>
            <input
              className="form-input"
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="Ex.: Proposta para Empresa XYZ"
              required
              maxLength={200}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Etapa *</label>
            <FormSelect
              value={form.stageId}
              onChange={(v) => setField("stageId", v)}
              options={stageOptions}
              placeholder="Selecionar etapa…"
            />
          </div>

          <div className="form-field">
            <label className="form-label">Valor (R$)</label>
            <DecimalInput
              value={form.valueReais}
              onChange={(v) => setField("valueReais", v)}
              placeholder="0,00"
            />
          </div>

          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">Contato</label>
            <input
              className="form-input"
              placeholder="Buscar por nome ou telefone…"
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
            />
            {contactSearch.length > 0 && (
              <FormSelect
                value={form.contactId}
                onChange={(v) => setField("contactId", v)}
                options={contactOptions}
                placeholder={contactLoading ? "Buscando…" : "Selecionar contato…"}
              />
            )}
          </div>

          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">Observações</label>
            <textarea
              className="form-input"
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="Anotações sobre o negócio…"
              rows={3}
              maxLength={2000}
              style={{ resize: "vertical" }}
            />
          </div>
        </div>

        {error && (
          <div style={{
            marginTop: 12, padding: "8px 12px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 8, color: "#fca5a5", fontSize: 12,
          }}>
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
