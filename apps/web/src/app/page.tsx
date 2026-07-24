"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useAuthContext } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import {
  MessageSquare, Zap, BarChart3, ArrowRight, Check,
  Bot, ShoppingCart, Crown, Rocket, ChevronRight,
  Shield, Clock, Users, Star,
} from "lucide-react";

/* ─── Redirect if already signed in ─────────────────────────── */
function useAuthRedirect() {
  const { isSignedIn, isLoaded } = useAuthContext();
  const router = useRouter();
  useEffect(() => {
    if (isLoaded && isSignedIn) router.replace("/overview");
  }, [isLoaded, isSignedIn, router]);
}

/* ─── Intersection observer for scroll reveals ───────────────── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) { el.classList.add("revealed"); obs.disconnect(); } },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

/* ─── Data ───────────────────────────────────────────────────── */
const PLANS = [
  {
    id: "STARTER", name: "Starter", price: "197",
    desc: "Ideal para começar a vender no WhatsApp",
    icon: Zap, iconColor: "#818cf8", highlight: false,
    features: ["500 conversas/mês", "100 produtos", "2 agentes humanos", "Analytics básico"],
  },
  {
    id: "GROWTH", name: "Growth", price: "497",
    desc: "O mais escolhido por lojas em crescimento",
    icon: Rocket, iconColor: "#22C55E", highlight: true,
    features: ["3.000 conversas/mês", "1.000 produtos", "5 agentes humanos", "Analytics completo"],
  },
  {
    id: "SCALE", name: "Scale", price: "997",
    desc: "Volume alto e operação completa",
    icon: Crown, iconColor: "#fbbf24", highlight: false,
    features: ["10.000 conversas/mês", "Produtos ilimitados", "15 agentes humanos", "Analytics avançado + Export"],
  },
] as const;

const FEATURES = [
  {
    icon: Bot, color: "#6366F1", bg: "rgba(99,102,241,0.1)", border: "rgba(99,102,241,0.2)",
    title: "IA que entende contexto",
    desc: "LangGraph + GPT-4o lembra o histórico, entende intenção e guia o cliente até o pagamento sem perder o fio da conversa.",
    tag: "LangGraph · GPT-4o",
  },
  {
    icon: ShoppingCart, color: "#22C55E", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.2)",
    title: "Venda direto no WhatsApp",
    desc: "Catálogo inteligente, carrinho de compras e link de pagamento Pix gerado em segundos — tudo sem sair da conversa.",
    tag: "Catálogo · Pix · MercadoPago",
  },
  {
    icon: BarChart3, color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)",
    title: "Analytics em tempo real",
    desc: "Acompanhe conversas, receita, handoffs e taxa de conversão em um dashboard atualizado ao vivo.",
    tag: "Dashboard · Relatórios",
  },
];

const STEPS = [
  { n: "01", title: "Conecta o número", desc: "Vincule seu número WhatsApp Business à plataforma em menos de 5 minutos via Meta Cloud API.", color: "#6366F1" },
  { n: "02", title: "Configura o agente", desc: "Defina a persona, catálogo de produtos e regras de atendimento pela interface visual.", color: "#22C55E" },
  { n: "03", title: "Bot responde 24/7", desc: "O agente IA atende, vende e escalona para humanos automaticamente, mesmo enquanto você dorme.", color: "#f59e0b" },
];

const STATS = [
  { value: "24/7", label: "Atendimento contínuo" },
  { value: "< 2s", label: "Tempo de resposta" },
  { value: "GPT-4o", label: "Modelo de linguagem" },
  { value: "0", label: "Custo por conversa" },
];

/* ─── Chat Mockup ─────────────────────────────────────────────── */
function ChatMockup() {
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
          Olá! Sou a Carla 👋 Posso ajudar com nosso catálogo de camisetas. O que procura?
        </div>
        <div className="lp-msg lp-msg-user">
          Quero uma camiseta preta tamanho M
        </div>
        <div className="lp-msg lp-msg-bot">
          Perfeita escolha! Temos a <strong>Camiseta Premium Preta</strong> por <strong>R$59,90</strong> — 100% algodão, corte slim. Disponível no seu tamanho ✅
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

/* ─── Section wrappers ───────────────────────────────────────── */
function RevealSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useReveal();
  return <div ref={ref} className={`reveal-section ${className}`}>{children}</div>;
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function HomePage() {
  useAuthRedirect();

  return (
    <>
      <div className="lp-root">

        {/* Gradient orbs */}
        <div className="lp-orb lp-orb-1" />
        <div className="lp-orb lp-orb-2" />
        <div className="lp-orb lp-orb-3" />
        <div className="lp-grid-bg" />

        {/* ── Navbar ─────────────────────────────────────── */}
        <nav className="lp-nav">
          <div className="lp-nav-inner">
            <a href="#" className="lp-logo">
              <MessageSquare size={20} color="#22C55E" strokeWidth={2} />
              <span>WhatsAgent</span>
            </a>
            <div className="lp-nav-links">
              <a href="#features">Features</a>
              <a href="#como-funciona">Como funciona</a>
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

        {/* ── Hero ───────────────────────────────────────── */}
        <section className="lp-hero">
          <div className="lp-hero-inner">
            <div className="lp-hero-text">
              <div className="lp-badge">
                <span className="lp-badge-dot" />
                IA + WhatsApp Business
              </div>
              <h1 className="lp-headline">
                Atendimento automático<br />
                que <span className="lp-gradient-text">vende enquanto</span><br />
                <span className="lp-gradient-text">você dorme</span>
              </h1>
              <p className="lp-subheadline">
                Conecte sua loja ao WhatsApp e deixe a IA responder clientes,
                apresentar produtos e fechar vendas com Pix — sem nenhum esforço manual.
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
              <p className="lp-hero-note">
                <Shield size={12} /> Sem cartão de crédito · Cancele quando quiser
              </p>
            </div>
            <div className="lp-hero-visual">
              <ChatMockup />
              <div className="lp-hero-glow" />
            </div>
          </div>

          {/* Stats bar */}
          <div className="lp-stats-bar">
            {STATS.map((s) => (
              <div key={s.label} className="lp-stat">
                <span className="lp-stat-value">{s.value}</span>
                <span className="lp-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ───────────────────────────────────── */}
        <section id="features" className="lp-section">
          <RevealSection>
            <div className="lp-section-label">Features</div>
            <h2 className="lp-section-title">Tudo que você precisa para vender no WhatsApp</h2>
            <p className="lp-section-sub">Da IA ao pagamento, tudo integrado em uma plataforma.</p>
            <div className="lp-features-grid">
              {FEATURES.map((f) => (
                <div key={f.title} className="lp-feature-card" style={{ "--glow": f.color } as React.CSSProperties}>
                  <div className="lp-feature-icon" style={{ background: f.bg, border: `1px solid ${f.border}` }}>
                    <f.icon size={20} color={f.color} strokeWidth={1.8} />
                  </div>
                  <h3 className="lp-feature-title">{f.title}</h3>
                  <p className="lp-feature-desc">{f.desc}</p>
                  <div className="lp-feature-tag">{f.tag}</div>
                </div>
              ))}
            </div>
          </RevealSection>
        </section>

        {/* ── How it works ───────────────────────────────── */}
        <section id="como-funciona" className="lp-section lp-section-alt">
          <RevealSection>
            <div className="lp-section-label">Como funciona</div>
            <h2 className="lp-section-title">Em 3 passos você está operando</h2>
            <p className="lp-section-sub">Setup simples, resultado imediato.</p>
            <div className="lp-steps">
              {STEPS.map((s, i) => (
                <div key={s.n} className="lp-step">
                  <div className="lp-step-num" style={{ color: s.color, borderColor: s.color + "40", background: s.color + "12" }}>{s.n}</div>
                  {i < STEPS.length - 1 && <div className="lp-step-connector" style={{ color: s.color }} />}
                  <h3 className="lp-step-title">{s.title}</h3>
                  <p className="lp-step-desc">{s.desc}</p>
                </div>
              ))}
            </div>
          </RevealSection>
        </section>

        {/* ── Pricing ────────────────────────────────────── */}
        <section id="precos" className="lp-section">
          <RevealSection>
            <div className="lp-section-label">Preços</div>
            <h2 className="lp-section-title">Plano certo para o seu momento</h2>
            <p className="lp-section-sub">7 dias grátis em qualquer plano. Sem cartão de crédito.</p>
            <div className="lp-plans">
              {PLANS.map((p) => (
                <div key={p.id} className={`lp-plan-card ${p.highlight ? "lp-plan-highlight" : ""}`} style={{ "--glow": p.iconColor } as React.CSSProperties}>
                  {p.highlight && <div className="lp-plan-badge">Mais popular</div>}
                  <div className="lp-plan-header">
                    <div className="lp-plan-icon" style={{ background: p.iconColor + "18", border: `1px solid ${p.iconColor}30` }}>
                      <p.icon size={18} color={p.iconColor} strokeWidth={1.8} />
                    </div>
                    <div>
                      <p className="lp-plan-name">{p.name}</p>
                      <p className="lp-plan-desc">{p.desc}</p>
                    </div>
                  </div>
                  <div className="lp-plan-price">
                    <span className="lp-plan-currency">R$</span>
                    <span className="lp-plan-amount">{p.price}</span>
                    <span className="lp-plan-period">/mês</span>
                  </div>
                  <ul className="lp-plan-features">
                    {p.features.map((f) => (
                      <li key={f}>
                        <Check size={13} color="#22C55E" strokeWidth={2.5} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/register" className={`lp-plan-cta ${p.highlight ? "lp-plan-cta-highlight" : ""}`}>
                    Começar grátis <ArrowRight size={13} strokeWidth={2.5} />
                  </Link>
                </div>
              ))}
            </div>
          </RevealSection>
        </section>

        {/* ── Final CTA ──────────────────────────────────── */}
        <section className="lp-cta-section">
          <RevealSection className="lp-cta-inner">
            <div className="lp-cta-glow" />
            <div className="lp-cta-stars">
              {[...Array(5)].map((_, i) => <Star key={i} size={14} color="#fbbf24" fill="#fbbf24" />)}
              <span>+200 lojas já usam o WhatsAgent</span>
            </div>
            <h2 className="lp-cta-title">
              Pronto para automatizar<br />seu atendimento?
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
          </RevealSection>
        </section>

        {/* ── Footer ─────────────────────────────────────── */}
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

      </div>
    </>
  );
}

