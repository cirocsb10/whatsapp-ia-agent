import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { getBuildInfo } = require("../../scripts/build-info.js");

const buildInfo = getBuildInfo(path.join(__dirname, "package.json"));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: [],
    // Tree-shake lucide/recharts no bundle (F5 §3.9).
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  // Mídia MinIO/S3 e WhatsApp (Meta CDN) passam pelo otimizador de imagens do Next.
  // URLs de produto são arbitrárias por tenant e não passam por remotePatterns — os
  // componentes que as renderizam usam `unoptimized` para que o Next.js server nunca
  // busque uma URL controlada pelo tenant (evita SSRF via /_next/image?url=).
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", pathname: "/**" },
      { protocol: "http", hostname: "127.0.0.1", pathname: "/**" },
      { protocol: "https", hostname: "**.amazonaws.com", pathname: "/**" },
      { protocol: "https", hostname: "**.cdn.whatsapp.net", pathname: "/**" },
      { protocol: "https", hostname: "mmg.whatsapp.net", pathname: "/**" },
      { protocol: "https", hostname: "**.fbcdn.net", pathname: "/**" },
    ],
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: buildInfo.version,
    NEXT_PUBLIC_BUILD_COMMIT: buildInfo.commit,
    NEXT_PUBLIC_BUILD_DATE: buildInfo.buildDate,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https: http:",
              "font-src 'self' data:",
              "connect-src 'self' https: wss: ws:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

// Upload de source maps só roda em CI com SENTRY_AUTH_TOKEN/ORG/PROJECT configurados;
// sem eles o plugin fica no-op (build local não é afetado).
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
});
