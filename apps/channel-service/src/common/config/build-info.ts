import { readFileSync } from "fs";
import { join } from "path";

export interface BuildInfo {
  version: string;
  commit: string;
  branch: string;
  buildDate: string | null;
}

let cached: BuildInfo | null = null;

export function getBuildInfo(): BuildInfo {
  if (cached) return cached;
  try {
    const raw = readFileSync(join(__dirname, "..", "..", "..", "build-info.json"), "utf8");
    cached = JSON.parse(raw);
  } catch {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, "..", "..", "..", "package.json"), "utf8"),
    );
    cached = { version: pkg.version, commit: "unknown", branch: "unknown", buildDate: null };
  }
  return cached!;
}
