import type { Metadata } from "next";
import { Outfit, Fraunces } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { Providers } from "./providers";
import { getServerUser } from "@/server/auth";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialUser = await getServerUser();

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${outfit.variable} ${fraunces.variable} bg-[#f8fafc] font-sans text-slate-900 antialiased`}>
        <NextTopLoader color="#22C55E" height={2} showSpinner={false} />
        <Providers initialUser={initialUser}>{children}</Providers>
      </body>
    </html>
  );
}
