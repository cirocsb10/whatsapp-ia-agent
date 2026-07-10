import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

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
  // URLs de produto (MinIO/S3) e mídia WhatsApp (Meta CDN) são arbitrárias por tenant.
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", pathname: "/**" },
      { protocol: "http", hostname: "127.0.0.1", pathname: "/**" },
      { protocol: "https", hostname: "**.amazonaws.com", pathname: "/**" },
      { protocol: "https", hostname: "**.cdn.whatsapp.net", pathname: "/**" },
      { protocol: "https", hostname: "mmg.whatsapp.net", pathname: "/**" },
      { protocol: "https", hostname: "**.fbcdn.net", pathname: "/**" },
      { protocol: "https", hostname: "**", pathname: "/**" },
      { protocol: "http", hostname: "**", pathname: "/**" },
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
        ],
      },
    ];
  },
};

export default nextConfig;
