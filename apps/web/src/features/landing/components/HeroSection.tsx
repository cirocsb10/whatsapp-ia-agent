import Link from "next/link";
import { ArrowRight, ChevronRight, Shield, Star } from "lucide-react";
import { ChatMockup } from "./ChatMockup";
import { STATS } from "../model/landing-data";

export function HeroSection() {
  return (
    <section className="lp-hero">
      <div className="lp-hero-inner">
        <div className="lp-hero-text">
          <div className="lp-badge">
            <span className="lp-badge-dot" />
            IA + WhatsApp Business
          </div>
          <h1 className="lp-headline">
            Sua loja responde,<br />
            atende e <span className="lp-gradient-text">vende no WhatsApp</span><br />
            24 horas por dia
          </h1>
          <p className="lp-subheadline">
            A IA da WhatsAgent conversa com cada cliente, mostra o catálogo certo e fecha a
            venda no Pix — enquanto sua equipe foca no que só um humano resolve.
          </p>
          <div className="lp-hero-ctas">
            <Link href="/register" className="lp-btn-primary lp-btn-lg">
              Começar 7 dias grátis
              <ArrowRight size={16} strokeWidth={2.5} />
            </Link>
            <a href="#como-funciona" className="lp-btn-outline">
              Ver como funciona
              <ChevronRight size={14} />
            </a>
          </div>
          <div className="lp-hero-trust">
            <div className="lp-hero-avatars">
              <span style={{ background: "#22C55E" }}>M</span>
              <span style={{ background: "#6366F1" }}>R</span>
              <span style={{ background: "#f59e0b" }}>L</span>
            </div>
            <span className="lp-hero-stars">
              {[...Array(5)].map((_, i) => <Star key={i} size={12} color="#f59e0b" fill="#f59e0b" />)}
            </span>
            <span>4,9/5 · +200 lojas atendidas</span>
          </div>
          <p className="lp-hero-note">
            <Shield size={12} /> Sem cartão de crédito · Cancele quando quiser
          </p>
        </div>
        <div className="lp-hero-visual">
          <ChatMockup />
          <div className="lp-hero-glow" />
        </div>
      </div>

      <div className="lp-stats-bar">
        {STATS.map((s) => (
          <div key={s.label} className="lp-stat">
            <span className="lp-stat-value">{s.value}</span>
            <span className="lp-stat-label">{s.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
