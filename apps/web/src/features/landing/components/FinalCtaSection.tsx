import Link from "next/link";
import { ArrowRight, Clock, Shield, Star, Users } from "lucide-react";

export function FinalCtaSection() {
  return (
    <section className="lp-cta-section">
      <div className="lp-cta-inner">
        <div className="lp-cta-glow" />
        <div className="lp-cta-stars">
          {[...Array(5)].map((_, i) => <Star key={i} size={14} color="#fbbf24" fill="#fbbf24" />)}
          <span>+200 lojas já usam o WhatsAgent</span>
        </div>
        <h2 className="lp-cta-title">
          Pronto para parar de perder<br />venda por falta de resposta?
        </h2>
        <p className="lp-cta-sub">Configure em minutos. Venda em segundos. Durma tranquilo.</p>
        <Link href="/register" className="lp-btn-primary lp-btn-xl">
          Começar agora — 7 dias grátis
          <ArrowRight size={18} strokeWidth={2.5} />
        </Link>
        <div className="lp-cta-trust">
          <span><Shield size={12} /> Dados protegidos</span>
          <span><Clock size={12} /> Setup em 5 minutos</span>
          <span><Users size={12} /> Suporte humano incluído</span>
        </div>
      </div>
    </section>
  );
}
