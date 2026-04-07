import { describe, expect, it } from "vitest";

import type { IbkrIntegrationConfig } from "@/modules/ibkr-integration/config";
import { resolveIbkrClientPortalCookieHeader } from "@/modules/ibkr-integration/session-resolve";
import { sealIbkrCpSessionCookie } from "@/modules/ibkr-integration/session-seal";

const secret = "k".repeat(32);

function baseConfig(over: Partial<IbkrIntegrationConfig> = {}): IbkrIntegrationConfig {
  return {
    enabled: true,
    paperTrading: true,
    maxRequestsPerMinute: 60,
    clientPortalBaseUrl: "https://localhost:5000",
    allowSessionCookieBody: true,
    useEnvSessionCookie: false,
    clientPortalSessionCookieFromEnv: undefined,
    ...over
  };
}

describe("resolveIbkrClientPortalCookieHeader", () => {
  it("prefers sealed user cookie over env", () => {
    const sealed = sealIbkrCpSessionCookie("user-cookie=1", secret);
    const r = resolveIbkrClientPortalCookieHeader({
      config: baseConfig({
        useEnvSessionCookie: true,
        clientPortalSessionCookieFromEnv: "env=only"
      }),
      sealedCookieValue: sealed,
      authSecret: secret
    });
    expect(r).toEqual({ ok: true, cookieHeader: "user-cookie=1", source: "user_cookie" });
  });

  it("uses env when no sealed cookie and useEnvSessionCookie", () => {
    const r = resolveIbkrClientPortalCookieHeader({
      config: baseConfig({
        useEnvSessionCookie: true,
        clientPortalSessionCookieFromEnv: "from=env"
      }),
      sealedCookieValue: undefined,
      authSecret: secret
    });
    expect(r).toEqual({ ok: true, cookieHeader: "from=env", source: "env" });
  });

  it("returns no_session when nothing available", () => {
    const r = resolveIbkrClientPortalCookieHeader({
      config: baseConfig(),
      sealedCookieValue: undefined,
      authSecret: secret
    });
    expect(r).toEqual({ ok: false, error: "no_session" });
  });
});
