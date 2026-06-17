import { afterEach, describe, expect, it } from "vitest";

import {
  resolveProxyInternalApiUrl,
  resolveProxyInternalOrigin
} from "@/lib/proxy-internal-origin";

const ENV_KEYS = ["K_SERVICE", "PORT", "PROXY_INTERNAL_ORIGIN"] as const;

function saveEnv(): Record<string, string | undefined> {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("resolveProxyInternalOrigin", () => {
  const envBefore = saveEnv();

  afterEach(() => {
    restoreEnv(envBefore);
  });

  it("uses loopback on Cloud Run (K_SERVICE set)", () => {
    process.env.K_SERVICE = "fintech-advisor-prod";
    process.env.PORT = "8080";
    expect(resolveProxyInternalOrigin("https://atxtrustedadvisory.com/xchat")).toBe(
      "http://127.0.0.1:8080"
    );
  });

  it("honors PROXY_INTERNAL_ORIGIN override", () => {
    process.env.K_SERVICE = "fintech-advisor-prod";
    process.env.PROXY_INTERNAL_ORIGIN = "http://127.0.0.1:9090";
    expect(resolveProxyInternalOrigin("https://atxtrustedadvisory.com/xchat")).toBe(
      "http://127.0.0.1:9090"
    );
  });

  it("uses request origin locally when not on Cloud Run", () => {
    delete process.env.K_SERVICE;
    expect(resolveProxyInternalOrigin("http://127.0.0.1:3000/xchat")).toBe("http://127.0.0.1:3000");
  });

  it("builds internal API URLs on the resolved origin", () => {
    process.env.K_SERVICE = "fintech-advisor-prod";
    process.env.PORT = "8080";
    const url = resolveProxyInternalApiUrl(
      "https://atxtrustedadvisory.com/xchat",
      "/api/internal/tenant-ux/policy"
    );
    expect(url.href).toBe("http://127.0.0.1:8080/api/internal/tenant-ux/policy");
  });
});
