import { Star } from "lucide-react";
import { TESTIMONIALS, RESULT_METRICS } from "../model/landing-data";

export function TestimonialsSection() {
  return (
    <section id="clientes" className="lp-section lp-section-alt">
      <div className="lp-section-label">Quem já usa</div>
      <h2 className="lp-section-title">Lojas que pararam de perder venda por falta de resposta</h2>
      <div className="lp-testi-grid">
        {TESTIMONIALS.map((t) => (
          <div key={t.name} className="lp-testi-card">
            <div className="lp-testi-stars">
              {[...Array(5)].map((_, i) => <Star key={i} size={13} color="#f59e0b" fill="#f59e0b" />)}
            </div>
            <p className="lp-testi-quote">&ldquo;{t.quote}&rdquo;</p>
            <div className="lp-testi-foot">
              <div className="lp-testi-avatar" style={{ background: t.color }}>{t.name[0]}</div>
              <div>
                <p className="lp-testi-name">{t.name}</p>
                <p className="lp-testi-role">{t.role}</p>
              </div>
              <span className="lp-testi-metric">{t.metric}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="lp-metric-strip">
        {RESULT_METRICS.map((m) => (
          <div key={m.label} className="lp-metric-tile">
            <span className="lp-metric-value">{m.value}</span>
            <span className="lp-metric-label">{m.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
