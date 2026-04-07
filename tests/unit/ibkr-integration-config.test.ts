import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ibkrAllowsSessionCookiePost, parseIbkrIntegrationConfig } from "@/modules/ibkr-integration/config";

describe("parseIbkrIntegrationConfig", () => {
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of [
      "IBKR_ENABLED",
      "IBKR_PAPER",
      "IBKR_MAX_REQUESTS_PER_MINUTE",
      "IBKR_CLIENT_PORTAL_BASE_URL",
      "IBKR_ALLOW_SESSION_COOKIE_BODY",
      "IBKR_USE_ENV_SESSION_COOKIE",
      "IBKR_CLIENT_PORTAL_SESSION_COOKIE"
    ]) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  });

  it("defaults to disabled with paper true and 60 rpm when unset", () => {
    const c = parseIbkrIntegrationConfig(process.env);
    expect(c.enabled).toBe(false);
    expect(c.paperTrading).toBe(true);
    expect(c.maxRequestsPerMinute).toBe(60);
    expect(c.clientPortalBaseUrl).toBeUndefined();
    expect(c.allowSessionCookieBody).toBe(false);
    expect(c.useEnvSessionCookie).toBe(false);
    expect(c.clientPortalSessionCookieFromEnv).toBeUndefined();
  });

  it("enables when IBKR_ENABLED is truthy", () => {
    process.env.IBKR_ENABLED = "1";
    expect(parseIbkrIntegrationConfig(process.env).enabled).toBe(true);
    process.env.IBKR_ENABLED = "true";
    expect(parseIbkrIntegrationConfig(process.env).enabled).toBe(true);
  });

  it("sets paperTrading false when IBKR_PAPER is falsey", () => {
    process.env.IBKR_ENABLED = "1";
    process.env.IBKR_PAPER = "0";
    const c = parseIbkrIntegrationConfig(process.env);
    expect(c.enabled).toBe(true);
    expect(c.paperTrading).toBe(false);
  });

  it("clamps IBKR_MAX_REQUESTS_PER_MINUTE to 1–300", () => {
    process.env.IBKR_MAX_REQUESTS_PER_MINUTE = "0";
    expect(parseIbkrIntegrationConfig(process.env).maxRequestsPerMinute).toBe(60);
    process.env.IBKR_MAX_REQUESTS_PER_MINUTE = "999";
    expect(parseIbkrIntegrationConfig(process.env).maxRequestsPerMinute).toBe(60);
    process.env.IBKR_MAX_REQUESTS_PER_MINUTE = "30";
    expect(parseIbkrIntegrationConfig(process.env).maxRequestsPerMinute).toBe(30);
  });

  it("accepts valid https client portal base URL", () => {
    process.env.IBKR_CLIENT_PORTAL_BASE_URL = "https://localhost:5000";
    expect(parseIbkrIntegrationConfig(process.env).clientPortalBaseUrl).toBe(
      "https://localhost:5000"
    );
  });

  it("drops non-https or invalid URLs", () => {
    process.env.IBKR_CLIENT_PORTAL_BASE_URL = "http://insecure.example";
    expect(parseIbkrIntegrationConfig(process.env).clientPortalBaseUrl).toBeUndefined();
    process.env.IBKR_CLIENT_PORTAL_BASE_URL = "not-a-url";
    expect(parseIbkrIntegrationConfig(process.env).clientPortalBaseUrl).toBeUndefined();
  });

  it("reads session policy env flags", () => {
    process.env.IBKR_ALLOW_SESSION_COOKIE_BODY = "1";
    process.env.IBKR_USE_ENV_SESSION_COOKIE = "true";
    process.env.IBKR_CLIENT_PORTAL_SESSION_COOKIE = "demo=1";
    const c = parseIbkrIntegrationConfig(process.env);
    expect(c.allowSessionCookieBody).toBe(true);
    expect(c.useEnvSessionCookie).toBe(true);
    expect(c.clientPortalSessionCookieFromEnv).toBe("demo=1");
  });

  it("ibkrAllowsSessionCookiePost is true in development", () => {
    expect(ibkrAllowsSessionCookiePost({ NODE_ENV: "development" })).toBe(true);
    expect(ibkrAllowsSessionCookiePost({ NODE_ENV: "production" })).toBe(false);
  });
});
