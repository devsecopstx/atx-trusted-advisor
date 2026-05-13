import { afterEach, describe, expect, it, vi } from "vitest";

import { assertHostedCloudRunRequiresAtxfinanceBackendOrigin } from "@/lib/hosted-bff-origin-gate";

describe("assertHostedCloudRunRequiresAtxfinanceBackendOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.ALLOW_MISSING_ATXFINANCE_BACKEND_ORIGIN;
  });

  it("no-ops in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ATX_DEPLOY_TARGET", "deploy");
    delete process.env.ATXFINANCE_BACKEND_ORIGIN;
    expect(() => assertHostedCloudRunRequiresAtxfinanceBackendOrigin()).not.toThrow();
  });

  it("no-ops in production without hosted deploy target", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATX_DEPLOY_TARGET", "");
    delete process.env.ATXFINANCE_BACKEND_ORIGIN;
    expect(() => assertHostedCloudRunRequiresAtxfinanceBackendOrigin()).not.toThrow();
  });

  it("throws in hosted production when origin missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATX_DEPLOY_TARGET", "deploy");
    delete process.env.ATXFINANCE_BACKEND_ORIGIN;
    expect(() => assertHostedCloudRunRequiresAtxfinanceBackendOrigin()).toThrow(/ATXFINANCE_BACKEND_ORIGIN is required/);
  });

  it("allows hosted production when origin set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATX_DEPLOY_TARGET", "stage");
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.run.app");
    expect(() => assertHostedCloudRunRequiresAtxfinanceBackendOrigin()).not.toThrow();
  });

  it("skips when ALLOW_MISSING_ATXFINANCE_BACKEND_ORIGIN=1", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATX_DEPLOY_TARGET", "deploy");
    delete process.env.ATXFINANCE_BACKEND_ORIGIN;
    vi.stubEnv("ALLOW_MISSING_ATXFINANCE_BACKEND_ORIGIN", "1");
    expect(() => assertHostedCloudRunRequiresAtxfinanceBackendOrigin()).not.toThrow();
  });
});
