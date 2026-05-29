export const metadata = {
  title: "WhatsAgent",
  description: "AI-powered WhatsApp sales agent platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
