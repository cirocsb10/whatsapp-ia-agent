"use client";

import { useApi } from "@/lib/hooks/useApi";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const TONES = ["FORMAL", "INFORMAL", "FRIENDLY", "TECHNICAL", "REGIONAL"];
const MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"];

export default function PersonaPage() {
  const { apiFetch } = useApi();
  const router = useRouter();
  const [form, setForm] = useState({
    agentName: "Assistente",
    tone: "FRIENDLY",
    greetingMessage: "Ola! Como posso ajudar?",
    inactivityMessage: "Ainda esta por aqui?",
    closingMessage: "Ate logo!",
    llmModel: "gpt-4o-mini",
    llmTemperature: 0.3,
    maxResponseLength: 500,
    systemPromptBase: "",
    isPublished: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await apiFetch("/agent/config");
      if (res.ok) {
        const data = await res.json();
        setForm((current) => ({ ...current, ...data }));
      }
    }
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    setSaving(true);
    const res = await apiFetch("/agent/config", {
      method: "PATCH",
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm">Voltar</button>
        <h1 className="text-xl font-semibold text-white">Persona do Agente</h1>
      </div>

      <div className="space-y-4">
        {[
          { label: "Nome do agente", key: "agentName" },
          { label: "Mensagem de boas-vindas", key: "greetingMessage" },
          { label: "Mensagem de inatividade", key: "inactivityMessage" },
          { label: "Mensagem de encerramento", key: "closingMessage" },
        ].map(({ label, key }) => (
          <label key={key} className="block">
            <span className="text-sm text-slate-400">{label}</span>
            <input
              value={(form as any)[key] ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm"
            />
          </label>
        ))}

        <label className="block">
          <span className="text-sm text-slate-400">Tom de voz</span>
          <select
            value={form.tone}
            onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))}
            className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm"
          >
            {TONES.map((tone) => <option key={tone} value={tone}>{tone}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-slate-400">Modelo LLM</span>
          <select
            value={form.llmModel}
            onChange={(e) => setForm((f) => ({ ...f, llmModel: e.target.value }))}
            className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm"
          >
            {MODELS.map((model) => <option key={model} value={model}>{model}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-slate-400">Prompt de sistema</span>
          <textarea
            value={form.systemPromptBase ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, systemPromptBase: e.target.value }))}
            rows={4}
            className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm font-mono"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-slate-400">Temperatura</span>
            <input
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={form.llmTemperature}
              onChange={(e) => setForm((f) => ({ ...f, llmTemperature: Number(e.target.value) }))}
              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm text-slate-400">Tamanho maximo</span>
            <input
              type="number"
              min={100}
              value={form.maxResponseLength}
              onChange={(e) => setForm((f) => ({ ...f, maxResponseLength: Number(e.target.value) }))}
              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm"
            />
          </label>
        </div>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={form.isPublished}
            onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
            className="w-4 h-4"
          />
          <span className="text-sm text-slate-300">Publicar agente</span>
        </label>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2 rounded-lg bg-green-500 hover:bg-green-600 text-black font-semibold text-sm disabled:opacity-50"
      >
        {saving ? "Salvando..." : saved ? "Salvo" : "Salvar persona"}
      </button>
    </div>
  );
}
