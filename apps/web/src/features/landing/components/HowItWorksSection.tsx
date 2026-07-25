import { STEPS } from "../model/landing-data";

export function HowItWorksSection() {
  return (
    <section id="como-funciona" className="lp-section">
      <div className="lp-section-label">Como funciona</div>
      <h2 className="lp-section-title">Em 3 passos você está operando</h2>
      <p className="lp-section-sub">Setup simples, resultado imediato.</p>
      <div className="lp-steps">
        {STEPS.map((s, i) => (
          <div key={s.n} className="lp-step">
            <div className="lp-step-num" style={{ color: s.color, borderColor: s.color + "40", background: s.color + "12" }}>{s.n}</div>
            {i < STEPS.length - 1 && <div className="lp-step-connector" style={{ color: s.color }} />}
            <h3 className="lp-step-title">{s.title}</h3>
            <p className="lp-step-desc">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
