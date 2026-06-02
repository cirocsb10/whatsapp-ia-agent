"use client";

import { Header } from "@/components/layout/Header";
import { TestSimulator } from "@/components/agent/TestSimulator";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import {
  Bot, Shield, Database, Settings, ArrowRight,
  Sparkles, BookOpen, Cpu, Sliders,
} from "lucide-react";
import Link from "next/link";

const CONFIG_SECTIONS = [
  {
    href: "/agent/persona",
    label: "Persona",
    desc: "Defina nome, tom de voz, saudacao e personalidade do agente.",
    icon: Bot,
    color: "#6366f1",
    bg: "rgba(99,102,241,0.1)",
    border: "rgba(99,102,241,0.2)",
    tag: "Identidade",
  },
  {
    href: "/agent/knowledge",
    label: "Base de Conhecimento",
    desc: "Adicione FAQs, documentos e contexto para o agente responder.",
    icon: Database,
    color: "#06b6d4",
    bg: "rgba(6,182,212,0.1)",
    border: "rgba(6,182,212,0.2)",
    tag: "Conhecimento",
  },
  {
    href: "/agent/rules",
    label: "Guard Rails",
    desc: "Configure regras anti-alucinacao e limites de comportamento.",
    icon: Shield,
    color: "#22c55e",
    bg: "rgba(34,197,94,0.1)",
    border: "rgba(34,197,94,0.2)",
    tag: "Seguranca",
  },
  {
    href: "/settings",
    label: "Configuracoes",
    desc: "Integracoes, webhooks, modelos de IA e configuracoes avancadas.",
    icon: Settings,
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.1)",
    border: "rgba(139,92,246,0.2)",
    tag: "Avancado",
  },
];

export default function AgentPage() {
  const { getToken } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
  const [config, setConfig] = useState<any>(null);
  const [knowledgeCount, setKnowledgeCount] = useState(0);
  const [rulesCount, setRulesCount] = useState(0);

  useEffect(() => {
    async function load() {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [configRes, knowledgeRes, rulesRes] = await Promise.all([
        fetch(`${API_URL}/agent/config`, { headers }),
        fetch(`${API_URL}/agent/knowledge`, { headers }),
        fetch(`${API_URL}/agent/rules`, { headers }),
      ]);
      if (configRes.ok) setConfig(await configRes.json());
      if (knowledgeRes.ok) setKnowledgeCount((await knowledgeRes.json()).length);
      if (rulesRes.ok) setRulesCount((await rulesRes.json()).length);
    }
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const published = Boolean(config?.isPublished);

  return (
    <div className="fade-up flex flex-col h-screen overflow-y-auto">
      <Header title="Agente IA" subtitle="Configure o comportamento do agente" />

      <div className="dashboard-page">
        <div className="agent-hero">
          <div className="agent-hero-glow" />

          <div className="agent-hero-left">
            <div className="agent-avatar-ring">
              <div className="agent-avatar-inner">
                <Bot className="w-7 h-7 text-indigo-300" strokeWidth={1.5} />
              </div>
              <span className="agent-avatar-pulse" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[17px] font-bold text-[#f1f5f9] tracking-tight">
                  {config?.agentName ?? "Assistente"}
                </h2>
                <span className={`tag ${published ? "tag-green" : "tag-slate"}`}>
                  {published ? "Publicado" : "Inativo"}
                </span>
              </div>
              <p className="text-[12px] text-[#475569] mt-1 leading-relaxed">
                {published ? "Agente ativo para atendimento." : "Revise a persona e publique quando estiver pronto."}
              </p>
            </div>
          </div>

          <div className="agent-hero-right">
            <div className="agent-stat">
              <Cpu className="w-3.5 h-3.5 text-[#475569]" strokeWidth={1.8} />
              <span className="text-[11px] text-[#475569]">Modelo</span>
              <span className="text-[11px] font-semibold text-[#94a3b8]">{config?.llmModel ?? "-"}</span>
            </div>
            <div className="agent-stat">
              <BookOpen className="w-3.5 h-3.5 text-[#475569]" strokeWidth={1.8} />
              <span className="text-[11px] text-[#475569]">Documentos</span>
              <span className="text-[11px] font-semibold text-[#94a3b8]">{knowledgeCount}</span>
            </div>
            <div className="agent-stat">
              <Sliders className="w-3.5 h-3.5 text-[#475569]" strokeWidth={1.8} />
              <span className="text-[11px] text-[#475569]">Guard rails</span>
              <span className="text-[11px] font-semibold text-[#94a3b8]">{rulesCount}</span>
            </div>
          </div>
        </div>

        <section>
          <div className="dashboard-section-head">
            <p className="section-title">Configuracao</p>
            <span className="text-[10px] text-[#475569]">4 secoes</span>
          </div>
          <div className="agent-config-grid">
            {CONFIG_SECTIONS.map(({ href, label, desc, icon: Icon, color, bg, border, tag }) => (
              <Link key={href} href={href} className="agent-config-card" style={{ "--card-glow": color } as React.CSSProperties}>
                <div className="agent-config-card-top">
                  <div className="agent-config-icon" style={{ background: bg, borderColor: border }}>
                    <Icon className="w-4 h-4" style={{ color }} strokeWidth={1.8} />
                  </div>
                  <span className="agent-config-tag" style={{ color, background: bg, borderColor: border }}>
                    {tag}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-[#f1f5f9] mt-3 mb-1">{label}</p>
                  <p className="text-[12px] text-[#475569] leading-relaxed">{desc}</p>
                </div>
                <div className="agent-config-footer" style={{ borderColor: `${color}18` }}>
                  <span className="text-[11px] font-medium" style={{ color }}>Configurar</span>
                  <ArrowRight className="w-3.5 h-3.5" style={{ color }} strokeWidth={2} />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="dashboard-section-head">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.8} />
              <p className="section-title">Simulador de Teste</p>
            </div>
            <span className="text-[10px] text-[#475569]">Teste o agente antes de ativar</span>
          </div>
          <TestSimulator tenantId="current" />
        </section>
      </div>
    </div>
  );
}
