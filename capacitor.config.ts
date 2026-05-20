import type { CapacitorConfig } from "@capacitor/cli";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Capacitor CLI does not load `.env` automatically. We merge `.env` / `.env.local` so
 * `PUBLIC_APP_BASE_URL` (and optional `CAPACITOR_SERVER_URL`) apply when you run
 * `npx cap sync ios` without manual exports. Shell env vars always win.
 */
function parseEnvFile(rel: string): Record<string, string> {
  const out: Record<string, string> = {};
  const p = join(process.cwd(), rel);
  if (!existsSync(p)) return out;
  const text = readFileSync(p, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\r$/, "").trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function mergeDotenvIntoProcess(): void {
  const merged = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
  for (const [k, v] of Object.entries(merged)) {
    if (v !== "" && process.env[k] === undefined) {
      process.env[k] = v;
    }
  }
}

mergeDotenvIntoProcess();

function stripTrailingSlash(u: string): string {
  return u.replace(/\/+$/, "");
}

/**
 * WebView entry URL for the Next.js app (`output: "standalone"` — not a static export in `webDir`).
 *
 * Resolution order (first wins):
 * 1. `CAPACITOR_SERVER_URL` — use for CI/TestFlight when `.env` is not the prod file.
 * 2. `PUBLIC_APP_BASE_URL` — same canonical origin as email links / deploy (e.g. `https://fintech-advisor.ai`).
 * 3. Default `http://127.0.0.1:3000` — simulator + `npm run dev`.
 *
 * Before App Store / TestFlight archive: ensure this resolves to your **HTTPS** production origin
 * (`npx cap sync ios` after setting env, then build in Xcode).
 */
function resolveServerUrl(): string {
  const explicit = process.env.CAPACITOR_SERVER_URL?.trim();
  if (explicit) return stripTrailingSlash(explicit);

  const pub = process.env.PUBLIC_APP_BASE_URL?.trim();
  if (pub && /^https?:\/\//i.test(pub)) {
    return stripTrailingSlash(pub);
  }

  return "http://127.0.0.1:3000";
}

const serverUrl = resolveServerUrl();

const isLikelyLocalHttp =
  /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(serverUrl) ||
  /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?\/?$/i.test(serverUrl);

if (serverUrl.startsWith("http://") && !isLikelyLocalHttp) {
  console.warn(
    "[capacitor] server.url uses http:// for a non-loopback origin — use HTTPS for production iOS builds:",
    serverUrl
  );
}

const config: CapacitorConfig = {
  appId: "com.atxfinance.ai",
  appName: "aTx Advisor",
  webDir: "public",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
  },
};

export default config;
