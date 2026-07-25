import { SECTORS } from "../model/landing-data";

export function TrustBarSection() {
  return (
    <div className="lp-trust-bar">
      <div className="lp-trust-bar-inner">
        <span className="lp-trust-label">Usado por lojas de:</span>
        <div className="lp-sector-chips">
          {SECTORS.map((s) => (
            <span key={s} className="lp-sector-chip">{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
