import { MessageSquare } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-inner">
        <a href="#" className="lp-logo">
          <MessageSquare size={16} color="#22C55E" strokeWidth={2} />
          <span>WhatsAgent</span>
        </a>
        <p className="lp-footer-copy">© 2026 WhatsAgent. Todos os direitos reservados.</p>
        <div className="lp-footer-links">
          <a href="#">Termos</a>
          <a href="#">Privacidade</a>
        </div>
      </div>
    </footer>
  );
}
