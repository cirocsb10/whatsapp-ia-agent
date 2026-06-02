"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
const TYPES = ["TEXT_BLOCK", "SEMANTIC_BLOCK", "NUMERIC_CAP", "PRODUCT_RESTRICT", "HANDOFF_TRIGGER", "REGEX_MATCH"];
const ACTIONS = ["BLOCK", "REWRITE", "HANDOFF", "LOG_ONLY"];
interface Rule { id: string; name: string; type: string; action: string; isActive: boolean; priority: number; }

export default function RulesPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", type: "TEXT_BLOCK", action: "BLOCK", config: "{}", fallbackMessage: "", priority: 100 });
  const [saving, setSaving] = useState(false);
  const [cfgErr, setCfgErr] = useState<string | null>(null);

  async function load() {
    const token = await getToken();
    const res = await fetch(`${API_URL}/agent/rules`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setRules(await res.json());
  }
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    setCfgErr(null);
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(form.config);
    } catch {
      setCfgErr("Config deve ser JSON valido");
      return;
    }
    setSaving(true);
    const token = await getToken();
    const res = await fetch(`${API_URL}/agent/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, config }),
    });
    if (res.ok) {
      setAdding(false);
      setForm({ name: "", type: "TEXT_BLOCK", action: "BLOCK", config: "{}", fallbackMessage: "", priority: 100 });
      await load();
    }
    setSaving(false);
  }

  async function handleToggle(rule: Rule) {
    const token = await getToken();
    await fetch(`${API_URL}/agent/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    await load();
  }

  async function handleDelete(id: string) {
    const token = await getToken();
    await fetch(`${API_URL}/agent/rules/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    await load();
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm">Voltar</button>
          <h1 className="text-xl font-semibold text-white">Guard Rules</h1>
        </div>
        <button onClick={() => setAdding((v) => !v)} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium">Nova regra</button>
      </div>

      {adding && (
        <div className="rounded-xl bg-slate-900 border border-slate-700 p-4 space-y-3">
          <input placeholder="Nome da regra" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm">
              {TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <select value={form.action} onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))} className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm">
              {ACTIONS.map((action) => <option key={action} value={action}>{action}</option>)}
            </select>
          </div>
          <input type="number" placeholder="Prioridade" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) || 100 }))} className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm" />
          <textarea placeholder='Config JSON, ex: {"terms":["desconto"]}' value={form.config} onChange={(e) => setForm((f) => ({ ...f, config: e.target.value }))} rows={3} className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm font-mono" />
          {cfgErr && <p className="text-red-400 text-xs">{cfgErr}</p>}
          <input placeholder="Mensagem de fallback" value={form.fallbackMessage} onChange={(e) => setForm((f) => ({ ...f, fallbackMessage: e.target.value }))} className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm" />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving || !form.name} className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-black text-sm font-semibold disabled:opacity-50">{saving ? "Salvando..." : "Salvar"}</button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 rounded-lg bg-slate-700 text-white text-sm">Cancelar</button>
          </div>
        </div>
      )}

      {rules.length === 0 && !adding && <p className="text-slate-500 text-sm text-center py-12">Nenhuma guard rule configurada.</p>}
      <div className="space-y-2">
        {rules.map((rule) => (
          <div key={rule.id} className="flex items-center justify-between rounded-xl bg-slate-900 border border-slate-700 px-4 py-3">
            <div>
              <p className="text-white text-sm font-medium">{rule.name}</p>
              <p className="text-slate-500 text-xs">{rule.type} - {rule.action} - prioridade {rule.priority}</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => void handleToggle(rule)} className={`text-xs px-2 py-1 rounded ${rule.isActive ? "bg-green-900/50 text-green-400" : "bg-slate-700 text-slate-400"}`}>
                {rule.isActive ? "Ativa" : "Inativa"}
              </button>
              <button onClick={() => void handleDelete(rule.id)} className="text-red-400 hover:text-red-300 text-xs">Remover</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
