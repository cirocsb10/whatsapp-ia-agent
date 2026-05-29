"use client";
import { useState, useRef, useEffect } from "react";
import { Send, RefreshCw, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface Msg { role: "user" | "assistant"; content: string; }

export function TestSimulator({ tenantId }: { tenantId: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    const msg = input.trim(); setInput(""); setLoading(true);
    setMessages((p) => [...p, { role: "user", content: msg }]);
    await new Promise((r) => setTimeout(r, 800));
    setMessages((p) => [...p, { role: "assistant", content: `Resposta simulada para: "${msg}". Configure o AI Orchestrator para respostas reais.` }]);
    setLoading(false);
  }

  return (
    <div className="glass-card flex flex-col h-[500px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E293B]">
        <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center"><Bot className="w-4 h-4 text-green-400" /></div><p className="text-sm font-semibold text-white">Simulador de Teste</p></div>
        <button onClick={() => setMessages([])} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[#334155] text-slate-500 hover:text-slate-300 cursor-pointer"><RefreshCw className="w-3.5 h-3.5" /> Resetar</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && <div className="flex flex-col items-center justify-center h-full text-center"><Bot className="w-10 h-10 text-slate-700 mb-3" /><p className="text-sm text-slate-600">Envie uma mensagem para testar</p></div>}
        {messages.map((m, i) => <div key={i} className={cn("flex gap-2 mb-2", m.role === "user" ? "justify-end" : "justify-start")}><div className={cn("max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm", m.role === "user" ? "bg-green-500/20 text-green-100 rounded-br-sm" : "bg-[#1E293B] text-slate-100 rounded-bl-sm")}><p className="whitespace-pre-wrap">{m.content}</p></div></div>)}
        {loading && <div className="flex gap-2"><div className="bg-[#1E293B] px-4 py-3 rounded-2xl rounded-bl-sm"><div className="flex gap-1">{[0,1,2].map((i) => <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse-dot" style={{ animationDelay: `${i*150}ms` }} />)}</div></div></div>}
        <div ref={bottomRef} />
      </div>
      <div className="px-4 py-3 border-t border-[#1E293B]">
        <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-center gap-2">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Digite uma mensagem de teste..." className="flex-1 bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50" disabled={loading} />
          <button type="submit" disabled={loading || !input.trim()} className="w-10 h-10 rounded-xl bg-green-500 hover:bg-green-400 disabled:bg-slate-700 text-white cursor-pointer flex items-center justify-center"><Send className="w-4 h-4" /></button>
        </form>
      </div>
    </div>
  );
}
