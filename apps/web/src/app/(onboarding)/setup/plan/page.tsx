"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  Check,
  ArrowRight,
  ArrowLeft,
  Zap,
  Rocket,
  Crown,
  CreditCard,
  Shield,
  Sparkles,
  LayoutDashboard,
} from "lucide-react";

const PLANS = [
  {
    id: "STARTER",
    name: "Starter",
    desc: "Ideal para começar a vender no WhatsApp",
    price: "197",
    icon: Zap,
    iconColor: "#818cf8",
    features: [
      "500 conversas/mês",
      "100 produtos",
      "2 agentes humanos",
      "Analytics básico",
    ],
  },
  {
    id: "GROWTH",
    name: "Growth",
    desc: "O mais escolhido por lojas em crescimento",
    price: "497",
    icon: Rocket,
    iconColor: "#4ade80",
    highlight: true,
    features: [
      "3.000 conversas/mês",
      "1.000 produtos",
      "5 agentes humanos",
      "Analytics completo",
    ],
  },
  {
    id: "SCALE",
    name: "Scale",
    desc: "Volume alto e operação completa",
    price: "997",
    icon: Crown,
    iconColor: "#fbbf24",
    features: [
      "10.000 conversas/mês",
      "Produtos ilimitados",
      "15 agentes humanos",
      "Analytics avançado + Export",
    ],
  },
] as const;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

export default function PlanPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function selectPlan(planId: string) {
    setLoading(planId);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: planId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { checkoutUrl } = await res.json();
      router.push(checkoutUrl);
    } catch {
      setError("Não foi possível iniciar o checkout. Tente novamente.");
      setLoading(null);
    }
  }

  return (
    <div className="onboarding-content-wide stagger-1">
      <div className="onboarding-plan-shell">
        {/* Progress */}
        <div className="onboarding-card-progress">
          <span className="section-title">Passo 5 de 5</span>
          <div className="prog-track h-1">
            <div className="prog-fill bg-green-500" style={{ width: "100%" }} />
          </div>
          <span className="text-[10px] font-semibold text-green-400 uppercase tracking-wider">
            Plano
          </span>
        </div>

        {/* Header */}
        <header className="onboarding-plan-header">
          <div className="onboarding-icon-wrap mx-auto">
            <CreditCard className="w-6 h-6 text-indigo-400 relative z-10" />
          </div>
          <h1>Escolha seu plano</h1>
          <p>Comece grátis por 14 dias. Cancele quando quiser, sem burocracia.</p>
          <div className="onboarding-trial-pill">
            <Sparkles className="w-3 h-3" />
            14 dias grátis em qualquer plano
          </div>
        </header>

        {/* Plan cards */}
        <div className="onboarding-plans-grid">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isFeatured = "highlight" in plan && plan.highlight;
            const isLoading = loading === plan.id;

            return (
              <article
                key={plan.id}
                className={`plan-card${isFeatured ? " plan-card-featured" : ""}`}
              >
                {isFeatured && (
                  <span className="plan-card-badge">Mais popular</span>
                )}

                <div
                  className="plan-card-icon"
                  style={!isFeatured ? { color: plan.iconColor } : undefined}
                >
                  <Icon className="w-4 h-4" />
                </div>

                <h2 className="plan-card-name">{plan.name}</h2>
                <p className="plan-card-desc">{plan.desc}</p>

                <div className="plan-card-price">
                  <p className="plan-card-price-value">
                    R$ {plan.price}
                    <span>/mês</span>
                  </p>
                </div>

                <ul className="plan-card-features">
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Check className="w-3.5 h-3.5" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => selectPlan(plan.id)}
                  className={isFeatured ? "onboarding-btn-primary" : "onboarding-btn-secondary"}
                  style={{ height: 42, fontSize: 13 }}
                >
                  {isLoading ? "Ativando…" : "Começar 14 dias grátis"}
                  {!isLoading && <ArrowRight className="w-4 h-4" />}
                </button>
              </article>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <p className="text-center text-[12px] text-red-400">{error}</p>
        )}

        {/* Footer */}
        <footer className="onboarding-plan-footer">
          <div className="onboarding-plan-guarantee">
            <Shield className="w-3.5 h-3.5 text-green-400" />
            Sem cartão de crédito · Cancele a qualquer momento
          </div>
          <Link href="/setup/company" className="onboarding-btn-ghost">
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </Link>
        </footer>

        {/* Next step hint */}
        <div className="onboarding-next-hint">
          <LayoutDashboard className="w-3.5 h-3.5 text-green-400" />
          <span>Próximo: acessar seu dashboard e conectar o WhatsApp</span>
        </div>
      </div>
    </div>
  );
}
