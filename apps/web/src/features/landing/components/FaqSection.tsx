import { FAQS } from "../model/landing-data";

export function FaqSection() {
  return (
    <section className="lp-section lp-section-alt">
      <div className="lp-section-label">Dúvidas comuns</div>
      <h2 className="lp-section-title">Perguntas frequentes</h2>
      <div className="lp-faq-list">
        {FAQS.map((item, i) => (
          <details key={item.q} className="lp-faq-item" open={i === 0}>
            <summary className="lp-faq-question">{item.q}</summary>
            <p className="lp-faq-answer">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
