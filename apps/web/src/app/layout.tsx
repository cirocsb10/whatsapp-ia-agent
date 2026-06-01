import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "WhatsAgent — Atendimento IA pelo WhatsApp", template: "%s | WhatsAgent" },
  description: "Plataforma de IA para atendimento e vendas automático via WhatsApp.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="pt-BR" suppressHydrationWarning>
        <body className="bg-[#020617] text-slate-50 antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
