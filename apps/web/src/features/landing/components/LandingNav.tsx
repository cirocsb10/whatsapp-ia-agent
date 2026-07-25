import Link from "next/link";
import { MessageSquare, ArrowRight } from "lucide-react";

export function LandingNav() {
  return (
    <nav className="lp-nav">
      <div className="lp-nav-inner">
        <a href="#" className="lp-logo">
          <MessageSquare size={20} color="#22C55E" strokeWidth={2} />
          <span>WhatsAgent</span>
        </a>
        <div className="lp-nav-links">
          <a href="#features">Features</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#clientes">Clientes</a>
          <a href="#precos">Preços</a>
        </div>
        <div className="lp-nav-actions">
          <Link href="/login" className="lp-btn-ghost">Entrar</Link>
          <Link href="/register" className="lp-btn-primary">
            Começar grátis <ArrowRight size={14} strokeWidth={2.5} />
          </Link>
        </div>
      </div>
    </nav>
  );
}
