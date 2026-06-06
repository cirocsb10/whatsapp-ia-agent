"use client";

import { Header } from "@/components/layout/Header";
import { useApi } from "@/lib/hooks/useApi";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Database,
  Plus,
  Trash2,
  FileText,
  Link2,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  BookOpen,
  Zap,
  X,
  Save,
} from "lucide-react";

interface KB {
  id: string;
  name: string;
  type: string;
  isIndexed: boolean;
  chunkCount?: number;
}

const TYPE_META: Record<
  string,
  { label: string; desc: string; icon: typeof FileText; color: string; bg: string; border: string }
> = {
  TEXT: {
    label: "Texto livre",
    desc: "FAQ, políticas, instruções",
    icon: FileText,
    color: "#06b6d4",
    bg: "rgba(6,182,212,0.12)",
    border: "rgba(6,182,212,0.25)",
  },
  URL: {
    label: "URL",
    desc: "Página web ou documento online",
    icon: Link2,
    color: "#818cf8",
    bg: "rgba(99,102,241,0.12)",
    border: "rgba(99,102,241,0.25)",
  },
};

const DEFAULT_FORM = { name: "", type: "TEXT", content: "" };

export default function KnowledgePage() {
  const { apiFetch } = useApi();
  const [items, setItems] = useState<KB[]>([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch("/agent/knowledge");
      if (res.ok) setItems(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const stats = useMemo(() => {
    const indexed = items.filter((i) => i.isIndexed).length;
    const chunks = items.reduce((sum, i) => sum + (i.chunkCount ?? 0), 0);
    return { total: items.length, indexed, chunks, pending: items.length - indexed };
  }, [items]);

  async function handleCreate() {
    setSaving(true);
    try {
      const res = await apiFetch("/agent/knowledge", {
        method: "POST",
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setForm(DEFAULT_FORM);
      setAdding(false);
      setToast({ type: "success", msg: "Documento adicionado — indexação em andamento" });
      await load();
    } catch {
      setToast({ type: "error", msg: "Erro ao salvar documento" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remover "${name}" da base de conhecimento?`)) return;
    setDeletingId(id);
    try {
      const res = await apiFetch(`/agent/knowledge/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setToast({ type: "success", msg: "Documento removido" });
      await load();
    } catch {
      setToast({ type: "error", msg: "Erro ao remover documento" });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="fade-up flex flex-col h-screen overflow-y-auto">
      <Header
        title="Base de Conhecimento"
        subtitle="Contexto e documentos para respostas precisas da IA"
      />

      {toast && (
        <div className={`kb-toast kb-toast--${toast.type}`}>
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {toast.msg}
        </div>
      )}

      <div className="dashboard-page kb-page">
        {/* Hero */}
        <div className={`kb-hero ${stats.total > 0 ? "kb-hero--active" : ""}`}>
          <div className="kb-hero-glow kb-hero-glow--cyan" aria-hidden="true" />
          <div className="kb-hero-glow kb-hero-glow--indigo" aria-hidden="true" />
          <div className="kb-hero-mesh" aria-hidden="true" />

          <div className="kb-hero-content">
            <div className={`kb-hero-icon ${stats.total > 0 ? "kb-hero-icon--active" : ""}`}>
              <Database className="w-6 h-6 text-cyan-400" strokeWidth={1.5} />
              {stats.pending > 0 && <span className="kb-hero-icon-pulse" aria-hidden="true" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="kb-hero-badge">
                <Sparkles className="w-3 h-3" strokeWidth={2} />
                RAG · Retrieval Augmented Generation
              </div>
              <h2 className="kb-hero-title">
                {loading ? "Carregando…" : `${stats.total} documento${stats.total !== 1 ? "s" : ""}`}
              </h2>
              <p className="kb-hero-sub">
                {stats.total === 0
                  ? "Alimente o agente com FAQs, catálogos e políticas."
                  : (
                    <>
                      <span className="kb-hero-accent">{stats.indexed} indexado{stats.indexed !== 1 ? "s" : ""}</span>
                      {stats.pending > 0 && (
                        <> · {stats.pending} aguardando indexação</>
                      )}
                      {stats.chunks > 0 && (
                        <> · {stats.chunks} chunks vetoriais</>
                      )}
                    </>
                  )}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className="kb-add-btn"
            >
              {adding ? (
                <>
                  <X className="w-4 h-4" strokeWidth={2} />
                  Cancelar
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" strokeWidth={2} />
                  Adicionar
                </>
              )}
            </button>
          </div>

          {stats.total > 0 && (
            <div className="kb-stats-row">
              {[
                { label: "Documentos", value: stats.total, icon: BookOpen, color: "#06b6d4" },
                { label: "Indexados", value: stats.indexed, icon: CheckCircle2, color: "#22c55e" },
                { label: "Chunks", value: stats.chunks, icon: Layers, color: "#818cf8" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div
                  key={label}
                  className="kb-stat-chip"
                  style={{ "--chip-accent": color } as React.CSSProperties}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color }} strokeWidth={1.8} />
                  <span className="kb-stat-value">{loading ? "…" : value}</span>
                  <span className="kb-stat-label">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info banner */}
        <div className="kb-info-banner">
          <div className="kb-info-icon">
            <Zap className="w-4 h-4 text-cyan-400" strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="kb-info-title">Como a base funciona</p>
            <p className="kb-info-desc">
              Cada documento é dividido em chunks e convertido em embeddings vetoriais.
              Quando um cliente pergunta algo, o agente busca os trechos mais relevantes antes de responder.
            </p>
          </div>
          <Link href="/agent" className="kb-info-link">
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar ao agente
          </Link>
        </div>

        {/* Add form */}
        {adding && (
          <section className="kb-form-panel" aria-label="Adicionar documento">
            <div className="kb-form-head">
              <div className="kb-form-head-icon">
                <Plus className="w-4 h-4 text-cyan-400" strokeWidth={1.8} />
              </div>
              <div>
                <p className="kb-form-title">Novo documento</p>
                <p className="kb-form-sub">O conteúdo será indexado automaticamente após salvar</p>
              </div>
            </div>

            <div className="kb-form-body">
              <label className="form-field">
                <span className="form-label">Nome do documento</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: FAQ de produtos, Política de trocas…"
                  className="form-input kb-form-input"
                />
              </label>

              <div className="form-field">
                <span className="form-label">Tipo de conteúdo</span>
                <div className="kb-type-grid" role="radiogroup" aria-label="Tipo de conteúdo">
                  {Object.entries(TYPE_META).map(([value, meta]) => {
                    const Icon = meta.icon;
                    const active = form.type === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setForm((f) => ({ ...f, type: value }))}
                        className={`kb-type-card ${active ? "kb-type-card--active" : ""}`}
                        style={
                          active
                            ? ({ "--type-accent": meta.color, "--type-bg": meta.bg, "--type-border": meta.border } as React.CSSProperties)
                            : undefined
                        }
                      >
                        <div
                          className="kb-type-icon"
                          style={{ background: meta.bg, borderColor: meta.border }}
                        >
                          <Icon className="w-4 h-4" style={{ color: meta.color }} strokeWidth={1.8} />
                        </div>
                        <div className="kb-type-text">
                          <span className="kb-type-label">{meta.label}</span>
                          <span className="kb-type-desc">{meta.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="form-field">
                <span className="form-label">
                  {form.type === "URL" ? "URL do documento" : "Conteúdo"}
                  <span className="form-label-hint">
                    {form.type === "URL"
                      ? " — link público acessível"
                      : " — cole o texto completo"}
                  </span>
                </span>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  rows={form.type === "URL" ? 2 : 6}
                  placeholder={
                    form.type === "URL"
                      ? "https://exemplo.com/pagina-de-ajuda"
                      : "Cole aqui o conteúdo que o agente deve conhecer…"
                  }
                  className="form-input form-input-mono kb-form-textarea"
                />
              </label>
            </div>

            <div className="kb-form-footer">
              <button
                type="button"
                onClick={() => { setAdding(false); setForm(DEFAULT_FORM); }}
                className="btn-ghost"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={saving || !form.name.trim() || !form.content.trim()}
                className="kb-save-btn"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando…
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" strokeWidth={2} />
                    Salvar e indexar
                  </>
                )}
              </button>
            </div>
          </section>
        )}

        {/* Document list */}
        <section>
          <div className="dashboard-section-head">
            <p className="section-title">Documentos</p>
            <span className="kb-section-count">
              {loading ? "Carregando…" : `${items.length} total`}
            </span>
          </div>

          {loading && (
            <div className="kb-list">
              {[1, 2, 3].map((i) => (
                <div key={i} className="kb-card kb-card--skeleton shimmer" />
              ))}
            </div>
          )}

          {!loading && items.length === 0 && !adding && (
            <div className="kb-empty">
              <div className="kb-empty-visual" aria-hidden="true">
                <div className="kb-empty-ring kb-empty-ring--1" />
                <div className="kb-empty-ring kb-empty-ring--2" />
                <div className="kb-empty-icon">
                  <Database className="w-8 h-8 text-slate-600" strokeWidth={1.5} />
                </div>
              </div>
              <p className="kb-empty-title">Nenhum documento ainda</p>
              <p className="kb-empty-desc">
                Adicione FAQs, catálogos ou URLs para que o agente responda com precisão
                usando o contexto do seu negócio.
              </p>
              <button type="button" onClick={() => setAdding(true)} className="kb-add-btn kb-add-btn--lg">
                <Plus className="w-4 h-4" strokeWidth={2} />
                Adicionar primeiro documento
              </button>
            </div>
          )}

          <div className="kb-list">
            {items.map((item, idx) => {
              const meta = TYPE_META[item.type] ?? TYPE_META.TEXT!;
              const Icon = meta.icon;
              const chunkPct = item.isIndexed
                ? Math.min(100, ((item.chunkCount ?? 0) / Math.max(stats.chunks, 1)) * 100 * items.length)
                : 0;

              return (
                <article
                  key={item.id}
                  className="kb-card"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div
                    className="kb-card-accent"
                    style={{ background: meta.color }}
                    aria-hidden="true"
                  />

                  <div
                    className="kb-card-icon"
                    style={{ background: meta.bg, borderColor: meta.border }}
                  >
                    <Icon className="w-4 h-4" style={{ color: meta.color }} strokeWidth={1.8} />
                  </div>

                  <div className="kb-card-body">
                    <div className="kb-card-top">
                      <h3 className="kb-card-name">{item.name}</h3>
                      <span
                        className="kb-type-badge"
                        style={{ color: meta.color, background: meta.bg, borderColor: meta.border }}
                      >
                        {meta.label}
                      </span>
                      <span
                        className={`kb-status-badge ${item.isIndexed ? "kb-status-badge--ready" : "kb-status-badge--pending"}`}
                      >
                        {item.isIndexed ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            Indexado
                          </>
                        ) : (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Indexando…
                          </>
                        )}
                      </span>
                    </div>

                    <div className="kb-card-meta">
                      {item.isIndexed ? (
                        <>
                          <Layers className="w-3 h-3 text-indigo-400" strokeWidth={1.8} />
                          <span>{item.chunkCount ?? 0} chunks vetoriais</span>
                        </>
                      ) : (
                        <>
                          <span className="kb-pending-dot" aria-hidden="true" />
                          <span>Aguardando processamento de embeddings</span>
                        </>
                      )}
                    </div>

                    {item.isIndexed && (item.chunkCount ?? 0) > 0 && (
                      <div className="kb-chunk-bar" aria-hidden="true">
                        <div
                          className="kb-chunk-fill"
                          style={{ width: `${Math.max(8, chunkPct)}%`, background: meta.color }}
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleDelete(item.id, item.name)}
                    disabled={deletingId === item.id}
                    className="kb-delete-btn"
                    aria-label={`Remover ${item.name}`}
                  >
                    {deletingId === item.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
