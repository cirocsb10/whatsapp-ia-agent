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
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: buildInfo.version,
    NEXT_PUBLIC_BUILD_COMMIT: buildInfo.commit,
    NEXT_PUBLIC_BUILD_DATE: buildInfo.buildDate,
  },
};

export default nextConfig;
