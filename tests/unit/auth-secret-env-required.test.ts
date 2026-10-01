import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("AUTH_SECRET env validation (S-001)", () => {
  const required = {
    XAI_API_KEY: "xai-key",
    XAI_MANAGEMENT_API_KEY: "mgmt-key",
    X_OAUTH_CLIENT_ID: "oauth-id",
    X_OAUTH_CLIENT_SECRET: "oauth-secret"
  } as const;

  beforeEach(() => {
    vi.resetModules();
    for (const [k, v] of Object.entries(required)) {
      process.env[k] = v;
    }
    delete process.env.AUTH_SECRET;
  });

  afterEach(() => {
    delete process.env.AUTH_SECRET;
  });

  it("rejects missing AUTH_SECRET", async () => {
    const { getEnv, __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    expect(() => getEnv()).toThrow(/Invalid environment configuration/);
  });

  it("rejects AUTH_SECRET shorter than 32 characters", async () => {
    process.env.AUTH_SECRET = "short-secret";
    const { getEnv, __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    expect(() => getEnv()).toThrow(/Invalid environment configuration/);
  });

  it("accepts AUTH_SECRET of at least 32 characters", async () => {
    process.env.AUTH_SECRET = "a".repeat(32);
    const { getEnv, __resetEnvCacheForTests } = await import("@/lib/env");
    __resetEnvCacheForTests();
    expect(getEnv().AUTH_SECRET).toBe("a".repeat(32));
  });

  it("lists AUTH_SECRET among REQUIRED_RUNTIME_ENV_VARS", async () => {
    const { REQUIRED_RUNTIME_ENV_VARS } = await import("@/lib/env");
    expect(REQUIRED_RUNTIME_ENV_VARS).toContain("AUTH_SECRET");
  });
});
