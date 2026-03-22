import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { REQUIRED_RUNTIME_ENV_VARS } from "@/lib/env";

function parseEnvExampleKeys(content: string): Set<string> {
  const keys = new Set<string>();
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key) keys.add(key);
  }
  return keys;
}

describe("env example parity and secrets hygiene", () => {
  it(".env.example includes all required runtime env vars", () => {
    const envPath = resolve(process.cwd(), ".env.example");
    const content = readFileSync(envPath, "utf8");
    const keys = parseEnvExampleKeys(content);

    for (const key of REQUIRED_RUNTIME_ENV_VARS) {
      expect(keys.has(key)).toBe(true);
    }
  });

  it("does not contain obvious live secrets or production keys", () => {
    const envPath = resolve(process.cwd(), ".env.example");
    const content = readFileSync(envPath, "utf8");

    // Heuristics: production Stripe keys start with pk_live_, avoid xai- real-looking long tokens, and long base64 strings on defaults.
    const forbiddenPatterns: RegExp[] = [
      /pk_live_[0-9a-zA-Z]{10,}/,
      /sk_live_[0-9a-zA-Z]{10,}/,
      /xai-[A-Za-z0-9_-]{20,}/,
    ];

    for (const re of forbiddenPatterns) {
      expect(re.test(content)).toBe(false);
    }
  });

  it("tenant defaults file is sanitized (no live keys/secrets)", () => {
    const seedDefaultsPath = resolve(process.cwd(), "tennat_defaults.yaml");
    const content = readFileSync(seedDefaultsPath, "utf8");

    const forbiddenPatterns: RegExp[] = [
      /pk_live_[0-9a-zA-Z]{10,}/,
      /sk_live_[0-9a-zA-Z]{10,}/,
      /xai-[A-Za-z0-9_-]{20,}/,
    ];

    for (const re of forbiddenPatterns) {
      expect(re.test(content)).toBe(false);
    }
  });
});
