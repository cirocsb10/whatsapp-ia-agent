import Link from "next/link";
import { MessageSquare } from "lucide-react";

function BrandMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-sm">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{label}</p>
    </div>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-50">
      <div className="flex min-h-screen">
        <aside className="relative hidden w-[46%] min-w-[430px] overflow-hidden bg-[#020617] lg:flex lg:flex-col lg:justify-between lg:p-12">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-20 top-16 h-72 w-72 rounded-full bg-[#22C55E]/10 blur-3xl" />
            <div className="absolute bottom-10 right-0 h-80 w-80 rounded-full bg-[#6366F1]/10 blur-3xl" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#22C55E]/15 text-[#22C55E]">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold">WhatsAgent</p>
                <p className="text-sm text-slate-400">Atendimento IA no WhatsApp</p>
              </div>
            </div>

            <h1 className="mt-12 max-w-md text-4xl font-bold leading-tight">
              Venda e atenda clientes com IA, sem perder o controle humano.
            </h1>
            <p className="mt-4 max-w-md text-slate-400">
              Plataforma multi-tenant para operação de WhatsApp com handoff, catálogo e analytics.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-4">
              <BrandMetric value="24/7" label="Respostas automáticas" />
              <BrandMetric value="98%" label="Satisfação média" />
              <BrandMetric value="3x" label="Mais conversões" />
            </div>
          </div>

          <p className="relative z-10 text-sm text-slate-500">
            © {new Date().getFullYear()} WhatsAgent. Todos os direitos reservados.
          </p>
        </aside>

        <main className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#22C55E]/15 text-[#22C55E]">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <p className="text-lg font-semibold">WhatsAgent</p>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-3xl font-bold">{title}</h2>
              <p className="mt-2 text-slate-400">{subtitle}</p>
            </div>

            {children}
            {footer}
          </div>
        </main>
      </div>
    </div>
  );
}

export function AuthLinkFooter({
  text,
  linkText,
  href,
}: {
  text: string;
  linkText: string;
  href: string;
}) {
  return (
    <p className="mt-8 text-center text-sm text-slate-400">
      {text}{" "}
      <Link href={href} className="font-medium text-[#22C55E] hover:underline">
        {linkText}
      </Link>
    </p>
  );
}
