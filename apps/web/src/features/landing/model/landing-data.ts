import { Bot, ShoppingCart, BarChart3, Users, Zap, Rocket, Crown } from "lucide-react";

export const PLANS = [
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
    features: ["3.000 conversas/mês", "1.000 produtos", "5 agentes humanos", "Analytics completo", "Prioridade no suporte"],
  },
  {
    id: "SCALE", name: "Scale", price: "997",
    desc: "Volume alto e operação completa",
    icon: Crown, iconColor: "#fbbf24", highlight: false,
    features: ["10.000 conversas/mês", "Produtos ilimitados", "15 agentes humanos", "Analytics avançado + Export"],
  },
] as const;

export const BENTO_FEATURES = [
  {
    span: "lp-bento-1", icon: Bot, color: "#6366F1", bg: "rgba(99,102,241,0.1)", border: "rgba(99,102,241,0.2)",
    title: "IA que entende contexto",
    desc: "LangGraph + GPT-4o lembra o histórico, entende intenção e guia o cliente até o pagamento sem perder o fio da conversa.",
    tag: "LangGraph · GPT-4o",
  },
  {
    span: "lp-bento-2", icon: ShoppingCart, color: "#22C55E", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.2)",
    title: "Venda direto no WhatsApp",
    desc: "Catálogo inteligente, carrinho de compras e link de pagamento Pix gerado em segundos — sem sair da conversa.",
    tag: "Catálogo · Pix · MercadoPago",
  },
  {
    span: "lp-bento-3", icon: BarChart3, color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)",
    title: "Analytics em tempo real",
    desc: "Conversas, receita e conversão atualizadas ao vivo.",
    tag: "Dashboard",
  },
  {
    span: "lp-bento-4", icon: Users, color: "#be123c", bg: "rgba(190,18,60,0.08)", border: "rgba(190,18,60,0.18)",
    title: "Handoff humano",
    desc: "Escala para seu time quando o caso exige.",
    tag: "Escalonamento",
  },
] as const;

export const STEPS = [
  { n: "01", title: "Conecta o número", desc: "Vincule seu número WhatsApp Business à plataforma em menos de 5 minutos via Meta Cloud API.", color: "#6366F1" },
  { n: "02", title: "Configura o agente", desc: "Defina a persona, catálogo de produtos e regras de atendimento pela interface visual.", color: "#22C55E" },
  { n: "03", title: "Bot responde 24/7", desc: "O agente IA atende, vende e escalona para humanos automaticamente, mesmo enquanto você dorme.", color: "#f59e0b" },
] as const;

export const STATS = [
  { value: "24/7", label: "Atendimento contínuo" },
  { value: "< 2s", label: "Tempo de resposta" },
  { value: "GPT-4o", label: "Modelo de linguagem" },
  { value: "0", label: "Custo por conversa" },
] as const;

export const SECTORS = ["Moda", "Beleza", "Alimentos", "Pet shop", "Eletrônicos", "Suplementos"] as const;

export const PROBLEMS = [
  { tag: "Perda", title: "Mensagens sem resposta à noite", desc: "O cliente pergunta às 22h, ninguém responde, e ele compra em outro lugar antes do seu time abrir." },
  { tag: "Lentidão", title: "Demora até no horário comercial", desc: "Cada atendente troca entre várias conversas ao mesmo tempo — a resposta chega depois que o interesse esfriou." },
  { tag: "Retrabalho", title: "Catálogo e Pix feitos na mão", desc: "Copiar link de produto, gerar cobrança, confirmar pagamento — tudo manual, tudo sujeito a erro." },
] as const;

export const TESTIMONIALS = [
  { quote: "Antes eu perdia pedido de madrugada. Hoje a IA fecha a venda enquanto eu durmo e só me chama quando é caso complicado.", name: "Mariana Souza", role: "Loja de moda feminina", metric: "+38% conversão", color: "#22C55E" },
  { quote: "Reduzi de 4 para 1 atendente no WhatsApp. O agente resolve o catálogo e o Pix sozinho, minha equipe só entra em pós-venda.", name: "Rafael Lima", role: "Pet shop", metric: "-70% tempo resposta", color: "#6366F1" },
  { quote: "Setup levou uma tarde. Em uma semana já tinha vendido mais no WhatsApp do que no mês anterior inteiro.", name: "Luiza Andrade", role: "Suplementos", metric: "+52% receita/mês", color: "#f59e0b" },
] as const;

export const RESULT_METRICS = [
  { value: "+200", label: "Lojas ativas" },
  { value: "1,4M+", label: "Conversas atendidas" },
  { value: "92%", label: "Resolvido sem humano" },
  { value: "4,9/5", label: "Avaliação média" },
] as const;

export const FAQS = [
  { q: "Funciona com o número que já uso?", a: "Sim — a conexão é feita via Meta Cloud API sobre o seu número atual, sem precisar trocar de WhatsApp." },
  { q: "Preciso saber programar para configurar?", a: "Não. Persona, catálogo e regras de atendimento são configurados pela interface visual do backoffice." },
  { q: "E se o cliente quiser falar com uma pessoa?", a: "O agente identifica o momento certo e escalona para um atendente humano automaticamente." },
  { q: "Posso cancelar quando quiser?", a: "Sim, sem contrato de fidelidade e sem multa — e os primeiros 7 dias são grátis em qualquer plano." },
] as const;
