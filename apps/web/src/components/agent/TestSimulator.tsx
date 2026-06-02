"use client";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Send, RefreshCw, Bot, User, Sparkles } from "lucide-react";

interface Msg { role: "user" | "assistant"; content: string; }

export function TestSimulator({ tenantId }: { tenantId: string }) {
  const { getToken } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    setLoading(true);
    setMessages((p) => [...p, { role: "user", content: msg }]);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg, tenantId }),
      });
      const data = res.ok ? await res.json() : null;
      setMessages((p) => [...p, { role: "assistant", content: data?.reply ?? "Nao consegui responder agora." }]);
    } catch {
      setMessages((p) => [...p, { role: "assistant", content: "Erro de conexao com o simulador." }]);
    }
    setLoading(false);
  }

  return (
    <div className="simulator-shell">
      {/* Header */}
      <div className="simulator-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
              <span className="text-[10px] text-[#475569]">Simulação local — sem integração real</span>
            </div>
          </div>
        </div>
        <button onClick={() => setMessages([])} className="simulator-reset-btn">
          <RefreshCw className="w-3 h-3" />
          Resetar
        </button>
      </div>

      {/* Messages */}
      <div className="simulator-body">
        {messages.length === 0 && (
          <div className="simulator-empty">
            <div className="simulator-empty-icon">
              <Sparkles className="w-5 h-5 text-indigo-400" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-semibold text-[#e2e8f0]">Teste seu agente</p>
            <p className="text-[12px] text-[#475569] text-center max-w-[220px] leading-relaxed">
              Envie uma mensagem como se fosse um cliente no WhatsApp
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 8,
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                alignItems: "flex-end",
              }}
            >
              {/* Bot avatar */}
              {m.role === "assistant" && (
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: "rgba(99,102,241,0.12)",
                  border: "1px solid rgba(99,102,241,0.22)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Bot style={{ width: 14, height: 14, color: "#818cf8" }} strokeWidth={1.8} />
                </div>
              )}

              {/* Bubble */}
              <div style={{
                maxWidth: "72%",
                padding: "10px 14px",
                borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                fontSize: 13,
                lineHeight: 1.55,
                wordBreak: "break-word",
                ...(m.role === "user"
                  ? {
                      background: "rgba(99,102,241,0.18)",
                      border: "1px solid rgba(99,102,241,0.3)",
                      color: "#e2e8f0",
                    }
                  : {
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#cbd5e1",
                    }
                ),
              }}>
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{m.content}</p>
              </div>

              {/* User avatar */}
              {m.role === "user" && (
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: "rgba(99,102,241,0.12)",
                  border: "1px solid rgba(99,102,241,0.22)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <User style={{ width: 14, height: 14, color: "#818cf8" }} strokeWidth={1.8} />
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: "rgba(99,102,241,0.12)",
                border: "1px solid rgba(99,102,241,0.22)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Bot style={{ width: 14, height: 14, color: "#818cf8" }} strokeWidth={1.8} />
              </div>
              <div style={{
                padding: "10px 16px",
                borderRadius: "14px 14px 14px 4px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: "#6366f1",
                        opacity: 0.6,
                        animation: "pulse-dot 1.4s ease-in-out infinite",
                        animationDelay: `${i * 180}ms`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div ref={bottomRef} />
      </div>

      {/* Input */}
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
          <button type="submit" disabled={loading || !input.trim()} className="simulator-send-btn">
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
