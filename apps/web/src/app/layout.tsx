import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Fraunces } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { Providers } from "./providers";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT", "WONK"],
});

export const metadata: Metadata = {
  title: { default: "WhatsAgent — Atendimento IA pelo WhatsApp", template: "%s | WhatsAgent" },
  description: "Plataforma de IA para atendimento e vendas automático via WhatsApp.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${plusJakarta.variable} ${fraunces.variable} bg-[#020617] font-sans text-slate-50 antialiased`}>
        <NextTopLoader color="#22C55E" height={2} showSpinner={false} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
