import Link from "next/link";
import { ArrowRight, Check, Shield } from "lucide-react";
import { PLANS } from "../model/landing-data";

export function PricingSection() {
  return (
    <section id="precos" className="lp-section">
      <div className="lp-section-label">Preços</div>
      <h2 className="lp-section-title">Plano certo para o seu momento</h2>
      <p className="lp-section-sub">7 dias grátis em qualquer plano. Sem cartão de crédito.</p>
      <div className="lp-plans">
        {PLANS.map((p) => (
          <div key={p.id} className={`lp-plan-card ${p.highlight ? "lp-plan-highlight" : ""}`} style={{ "--glow": p.iconColor } as React.CSSProperties}>
            {p.highlight && <div className="lp-plan-badge">Mais popular</div>}
            <div className="lp-plan-header">
              <div className="lp-plan-icon" style={{ background: p.iconColor + "18", border: `1px solid ${p.iconColor}30` }}>
                <p.icon size={18} color={p.iconColor} strokeWidth={1.8} />
              </div>
              <div>
                <p className="lp-plan-name">{p.name}</p>
                <p className="lp-plan-desc">{p.desc}</p>
              </div>
            </div>
            <div className="lp-plan-price">
              <span className="lp-plan-currency">R$</span>
              <span className="lp-plan-amount">{p.price}</span>
              <span className="lp-plan-period">/mês</span>
            </div>
            <ul className="lp-plan-features">
              {p.features.map((f) => (
                <li key={f}>
                  <Check size={13} color="#22C55E" strokeWidth={2.5} />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/register" className={`lp-plan-cta ${p.highlight ? "lp-plan-cta-highlight" : ""}`}>
              Começar grátis <ArrowRight size={13} strokeWidth={2.5} />
            </Link>
          </div>
        ))}
      </div>
      <p className="lp-plan-guarantee">
        <Shield size={13} /> 7 dias de garantia — cancele e não pague nada se não gostar
      </p>
    </section>
  );
}
