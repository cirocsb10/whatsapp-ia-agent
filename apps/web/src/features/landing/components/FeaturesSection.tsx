import { BENTO_FEATURES } from "../model/landing-data";

export function FeaturesSection() {
  return (
    <section id="features" className="lp-section lp-section-alt">
      <div className="lp-section-label">A solução</div>
      <h2 className="lp-section-title">Um agente de IA que atende, vende e sabe quando chamar um humano</h2>
      <p className="lp-section-sub">Tudo integrado: conversa, catálogo, pagamento e escalonamento.</p>
      <div className="lp-bento-grid">
        {BENTO_FEATURES.map((f) => (
          <div
            key={f.title}
            className={`lp-bento-card ${f.span}`}
            style={{ "--glow": f.color } as React.CSSProperties}
          >
            <div className="lp-feature-icon" style={{ background: f.bg, border: `1px solid ${f.border}` }}>
              <f.icon size={20} color={f.color} strokeWidth={1.8} />
            </div>
            <h3 className="lp-feature-title">{f.title}</h3>
            <p className="lp-feature-desc">{f.desc}</p>
            <div className="lp-feature-tag">{f.tag}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
