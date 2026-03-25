import { afterEach, describe, expect, it, vi } from "vitest";

describe("tenant-defaults-seed deploy slug (xAI trusted-advisor segment)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses stage when ATX_DEPLOY_TARGET=stage even if NODE_ENV=development", async () => {
    vi.stubEnv("ATX_DEPLOY_TARGET", "stage");
    vi.stubEnv("NODE_ENV", "development");
    const { resolveTrustedAdvisorDeploySlug } = await import("../../scripts/lib/tenant-defaults-seed.mjs");
    expect(resolveTrustedAdvisorDeploySlug({}, null)).toBe("stage");
  });

  it("uses dev when NODE_ENV=development and no explicit deploy tier", async () => {
    vi.stubEnv("ATX_DEPLOY_TARGET", "");
    vi.stubEnv("ATX_INSTANCE_ENV", "");
    vi.stubEnv("DEPLOY_TARGET", "");
    vi.stubEnv("NODE_ENV", "development");
    const { resolveTrustedAdvisorDeploySlug } = await import("../../scripts/lib/tenant-defaults-seed.mjs");
    expect(resolveTrustedAdvisorDeploySlug({}, null)).toBe("dev");
  });

  it("maps deploy tier to stage for trusted-advisor slug", async () => {
    vi.stubEnv("ATX_DEPLOY_TARGET", "deploy");
    vi.stubEnv("NODE_ENV", "development");
    const { resolveTrustedAdvisorDeploySlug } = await import("../../scripts/lib/tenant-defaults-seed.mjs");
    expect(resolveTrustedAdvisorDeploySlug({}, null)).toBe("stage");
  });
});
