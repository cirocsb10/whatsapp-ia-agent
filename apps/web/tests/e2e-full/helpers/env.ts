import { existsSync, readFileSync } from "fs";
import path from "path";

/**
 * Loader mínimo de .env — este teste roda contra serviços já em pé localmente
 * (não sobe seu próprio webServer), então precisa ler os MESMOS valores que o
 * channel-service já está usando (ex.: META_WEBHOOK_SECRET para assinar o
 * webhook simulado). Sem dependência de `dotenv`: só parseia KEY=VALUE.
 */
function loadEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(filePath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const REPO_ROOT = path.resolve(__dirname, "../../../../..");

// Mesma ordem de precedência usada pelo ConfigModule das APIs (main .env.local > .env).
const merged: Record<string, string> = {
  ...loadEnvFile(path.join(REPO_ROOT, ".env")),
  ...loadEnvFile(path.join(REPO_ROOT, ".env.local")),
};

export function repoEnv(key: string): string | undefined {
  return process.env[key] ?? merged[key];
}

export function requireRepoEnv(key: string): string {
  const value = repoEnv(key);
  if (!value) {
    throw new Error(
      `[e2e-full] ${key} não encontrado em .env.local/.env na raiz do repo. ` +
        `Esse valor precisa bater com o que o channel-service já está usando.`,
    );
  }
  return value;
}
