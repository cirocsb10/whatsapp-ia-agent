import { Bot } from "lucide-react";

export function ChatMockup() {
  return (
    <div className="lp-chat-wrap">
      <div className="lp-chat-header">
        <div className="lp-chat-avatar">
          <Bot size={14} color="#22C55E" />
        </div>
        <div>
          <p className="lp-chat-name">Carla · WhatsAgent IA</p>
          <p className="lp-chat-status"><span className="lp-online-dot" />Online agora</p>
        </div>
      </div>
      <div className="lp-chat-body">
        <div className="lp-msg lp-msg-bot">
          Olá! Sou a Carla 👋 Temos camisetas, moletons e bonés. O que você procura?
        </div>
        <div className="lp-msg lp-msg-user">
          Camiseta preta tamanho M
        </div>
        <div className="lp-msg lp-msg-bot">
          Temos a <strong>Camiseta Premium Preta</strong> por <strong>R$59,90</strong> — 100% algodão, corte slim. Disponível no seu tamanho ✅
        </div>
        <div className="lp-msg lp-msg-user">
          Quero comprar!
        </div>
        <div className="lp-msg lp-msg-bot lp-msg-pix">
          <div className="lp-pix-badge">
            <span className="lp-pix-icon">Pix</span>
            <span>Link gerado!</span>
          </div>
          Aqui está seu link de pagamento Pix de <strong>R$59,90</strong>. Expira em 30min ⚡
        </div>
        <div className="lp-typing">
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}
