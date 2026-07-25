import { PROBLEMS } from "../model/landing-data";

export function ProblemSection() {
  return (
    <section className="lp-section">
      <div className="lp-section-label">O problema</div>
      <h2 className="lp-section-title">Todo pedido perdido às 23h é um cliente que comprou no concorrente</h2>
      <p className="lp-section-sub">Atendimento manual não escala — e isso custa caro exatamente fora do horário comercial.</p>
      <div className="lp-problem-grid">
        {PROBLEMS.map((p) => (
          <div key={p.title} className="lp-problem-card">
            <span className="lp-problem-tag">{p.tag}</span>
            <h3 className="lp-problem-title">{p.title}</h3>
            <p className="lp-problem-desc">{p.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
