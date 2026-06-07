"use client";

import Link from "next/link";
import {
  ArrowRight, CheckCircle2, Circle, MessageCircle, Bot, Zap,
} from "lucide-react";

interface SetupStatus {
  whatsappConnected: boolean;
  agentConfigured: boolean;
  setupComplete: boolean;
}

interface DashboardSetupBannerProps {
  setup: SetupStatus | null;
  isEmpty: boolean;
}

const STEPS = [
  {
    key: "whatsapp" as const,
    label: "WhatsApp Business",
    desc: "Conecte seu número via Meta Cloud API",
    href: "/settings?tab=integracoes",
    icon: MessageCircle,
    color: "#22c55e",
  },
  {
    key: "agent" as const,
    label: "Agente IA",
    desc: "Persona, conhecimento e guard rails",
    href: "/agent",
    icon: Bot,
    color: "#6366f1",
  },
  {
    key: "live" as const,
    label: "Primeira conversa",
    desc: "Receba uma mensagem para ativar métricas",
    href: "/agent",
    icon: Zap,
    color: "#f59e0b",
  },
];

function stepDone(key: (typeof STEPS)[number]["key"], setup: SetupStatus, isEmpty: boolean) {
  if (key === "whatsapp") return setup.whatsappConnected;
  if (key === "agent") return setup.agentConfigured;
  return setup.setupComplete && !isEmpty;
}

export function DashboardSetupBanner({ setup, isEmpty }: DashboardSetupBannerProps) {
  if (!setup) return null;

  const completedCount = STEPS.filter((s) => stepDone(s.key, setup, isEmpty)).length;
  const progress = Math.round((completedCount / STEPS.length) * 100);
  const allDone = completedCount === STEPS.length;

  if (allDone) return null;

  const nextStep = STEPS.find((s) => !stepDone(s.key, setup, isEmpty)) ?? STEPS[0]!;

  return (
    <div className="dashboard-setup-banner">
      <div className="dashboard-setup-glow" aria-hidden="true" />

      <div className="dashboard-setup-main">
        <div className="dashboard-setup-head">
          <div>
            <p className="dashboard-setup-eyebrow">Configuração inicial</p>
            <p className="dashboard-setup-title">
              {setup.setupComplete && isEmpty
                ? "Quase lá — aguardando a primeira conversa"
                : "Complete o setup para ver dados reais"}
            </p>
            <p className="dashboard-setup-desc">
              {setup.setupComplete && isEmpty
                ? "WhatsApp e agente prontos. Envie uma mensagem de teste ou peça a um contato para iniciar."
                : "Siga os passos abaixo para ativar métricas, gráficos e automações."}
            </p>
          </div>

          <div className="dashboard-setup-progress-ring" aria-label={`${progress}% concluído`}>
            <svg viewBox="0 0 44 44" className="dashboard-setup-ring-svg">
              <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
              <circle
                cx="22" cy="22" r="18" fill="none"
                stroke="#22c55e" strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${progress * 1.13} 113`}
                transform="rotate(-90 22 22)"
              />
            </svg>
            <span className="dashboard-setup-ring-label">{progress}%</span>
          </div>
        </div>

        <div className="dashboard-setup-steps-grid">
          {STEPS.map((step) => {
            const done = stepDone(step.key, setup, isEmpty);
            const Icon = step.icon;
            const StatusIcon = done ? CheckCircle2 : Circle;

            return (
              <Link
                key={step.key}
                href={step.href}
                className={`dashboard-setup-step-card ${done ? "is-done" : ""} ${nextStep.key === step.key ? "is-next" : ""}`}
              >
                <div className="dashboard-setup-step-icon" style={{ ["--step-color" as string]: step.color }}>
                  <Icon className="w-4 h-4" strokeWidth={1.8} />
                </div>
                <div className="dashboard-setup-step-body">
                  <div className="dashboard-setup-step-row">
                    <span className="dashboard-setup-step-label">{step.label}</span>
                    <StatusIcon
                      className={`w-3.5 h-3.5 shrink-0 ${done ? "text-green-400" : "text-slate-600"}`}
                      strokeWidth={done ? 2 : 1.5}
                    />
                  </div>
                  <span className="dashboard-setup-step-desc">{step.desc}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <Link href={nextStep.href} className="dashboard-setup-cta">
        {nextStep.key === "live" ? "Testar agente" : "Continuar setup"}
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
