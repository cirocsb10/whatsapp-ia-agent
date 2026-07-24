import Link from "next/link";
import { MessageSquare } from "lucide-react";

function BrandMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="relative hidden w-[46%] min-w-[430px] overflow-hidden border-r border-slate-200 bg-white lg:flex lg:flex-col lg:justify-between lg:p-12">
          <div className="relative z-10">
            <Link href="/" className="flex items-center gap-3 no-underline">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#22C55E]/15 text-[#22C55E]">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">WhatsAgent</p>
                <p className="text-sm text-slate-500">Atendimento IA no WhatsApp</p>
              </div>
            </Link>

            <h1 className="mt-12 max-w-md text-4xl font-bold leading-tight text-slate-900">
              Venda e atenda clientes com IA, sem perder o controle humano.
            </h1>
            <p className="mt-4 max-w-md text-slate-500">
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
              <Link href="/" className="flex items-center gap-3 no-underline">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#22C55E]/15 text-[#22C55E]">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <p className="text-lg font-semibold text-slate-900">WhatsAgent</p>
              </Link>
            </div>

            <div className="mb-8">
              <h2 className="text-3xl font-bold text-slate-900">{title}</h2>
              <p className="mt-2 text-slate-500">{subtitle}</p>
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
    <p className="mt-8 text-center text-sm text-slate-500">
      {text}{" "}
      <Link href={href} className="font-medium text-[#22C55E] hover:underline">
        {linkText}
      </Link>
    </p>
  );
}
