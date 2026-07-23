"use client";
import { useState, useRef, useEffect } from "react";
import { Send, RefreshCw, Bot, User, Sparkles, UserCheck } from "lucide-react";
import { useAgentChat } from "@/features/agent/api/queries";

interface Msg {
  role: "user" | "assistant";
  content: string;
  handoffReason?: string | undefined;
}

export function TestSimulator() {
  const chat = useAgentChat();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const loading = chat.isPending;

  useEffect(() => {
    if (messages.length === 0 && !loading) return;
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    setMessages((p) => [...p, { role: "user", content: msg }]);
    try {
      const data = await chat.mutateAsync(msg);
      setMessages((p) => [
        ...p,
        {
          role: "assistant",
          content: data.reply ?? "Não consegui responder agora.",
          handoffReason: data.shouldHandoff ? (data.handoffReason ?? "Motivo não informado") : undefined,
        },
      ]);
    } catch {
      setMessages((p) => [...p, { role: "assistant", content: "Erro de conexão com o simulador." }]);
    }
  }

  return (
    <div className="simulator-shell">
      <div className="simulator-header">
        <div className="flex items-center gap-2.5">
          <div className="simulator-icon">
            <Bot className="w-3.5 h-3.5 text-green-400" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#e2e8f0]">Simulador de Teste</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-green-400 opacity-50 pulse-dot" />
                <span className="relative rounded-full h-1.5 w-1.5 bg-green-500" />
              </span>
              <span className="text-[10px] text-[#64748b]">Pipeline real (LangGraph) — sem WhatsApp</span>
            </div>
          </div>
        </div>
        <button type="button" onClick={() => setMessages([])} className="simulator-reset-btn">
          <RefreshCw className="w-3 h-3" />
          Resetar
        </button>
      </div>

      <div ref={bodyRef} className="simulator-body">
        {messages.length === 0 && (
          <div className="simulator-empty">
            <div className="simulator-empty-icon">
              <Sparkles className="w-5 h-5 text-indigo-400" strokeWidth={1.5} />
            </div>
            <p className="text-[14px] font-semibold text-[#e2e8f0]">Teste seu agente</p>
            <p className="text-[12px] text-[#64748b] text-center max-w-[260px] leading-relaxed">
              Envie uma mensagem como se fosse um cliente no WhatsApp
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div
                className={`simulator-msg-row ${m.role === "user" ? "simulator-msg-row--user" : "simulator-msg-row--bot"}`}
              >
                {m.role === "assistant" && (
                  <div className="simulator-avatar">
                    <Bot className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.8} />
                  </div>
                )}

                <div className={`simulator-bubble ${m.role === "user" ? "simulator-bubble--user" : "simulator-bubble--bot"}`}>
                  <p>{m.content}</p>
                </div>

                {m.role === "user" && (
                  <div className="simulator-avatar">
                    <User className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.8} />
                  </div>
                )}
              </div>

              {m.handoffReason && (
                <div className="simulator-handoff-badge" title={m.handoffReason}>
                  <UserCheck className="w-3 h-3" strokeWidth={2} />
                  Handoff acionado — {m.handoffReason}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="simulator-msg-row simulator-msg-row--bot">
              <div className="simulator-avatar">
                <Bot className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.8} />
              </div>
              <div className="simulator-typing">
                <div className="simulator-typing-dots">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="simulator-typing-dot"
                      style={{ animationDelay: `${i * 180}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="simulator-input-bar">
        <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="simulator-input-form">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Simule uma mensagem do cliente…"
            className="simulator-input"
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()} className="simulator-send-btn" aria-label="Enviar">
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
