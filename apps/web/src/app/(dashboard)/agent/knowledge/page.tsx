"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
interface KB { id: string; name: string; type: string; isIndexed: boolean; chunkCount?: number; }

export default function KnowledgePage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<KB[]>([]);
  const [form, setForm] = useState({ name: "", type: "TEXT", content: "" });
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const token = await getToken();
    const res = await fetch(`${API_URL}/agent/knowledge`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setItems(await res.json());
  }
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    setSaving(true);
    const token = await getToken();
    const res = await fetch(`${API_URL}/agent/knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ name: "", type: "TEXT", content: "" });
      setAdding(false);
      await load();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const token = await getToken();
    await fetch(`${API_URL}/agent/knowledge/${id}`, {
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
          <h1 className="text-xl font-semibold text-white">Base de Conhecimento</h1>
        </div>
        <button onClick={() => setAdding((v) => !v)} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium">Adicionar</button>
      </div>

      {adding && (
        <div className="rounded-xl bg-slate-900 border border-slate-700 p-4 space-y-3">
          <input placeholder="Nome" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm" />
          <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm">
            <option value="TEXT">Texto livre</option>
            <option value="URL">URL</option>
          </select>
          <textarea placeholder="Cole o conteudo aqui..." value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} rows={5} className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm font-mono" />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving || !form.name || !form.content} className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-black text-sm font-semibold disabled:opacity-50">{saving ? "Salvando..." : "Salvar"}</button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 rounded-lg bg-slate-700 text-white text-sm">Cancelar</button>
          </div>
        </div>
      )}

      {items.length === 0 && !adding && <p className="text-slate-500 text-sm text-center py-12">Nenhuma base de conhecimento.</p>}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-900 border border-slate-700 px-4 py-3">
            <div>
              <p className="text-white text-sm font-medium">{item.name}</p>
              <p className="text-slate-500 text-xs">{item.type} - {item.isIndexed ? `${item.chunkCount ?? 0} chunks` : "aguardando indexacao"}</p>
            </div>
            <button onClick={() => void handleDelete(item.id)} className="text-red-400 hover:text-red-300 text-xs">Remover</button>
          </div>
        ))}
      </div>
    </div>
  );
}
