import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { shouldProxyPersonasRequestsToBackend } from "@/lib/backend-bff";

describe("shouldProxyPersonasRequestsToBackend", () => {
  const original = { ...process.env };

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.ATXFINANCE_BACKEND_ORIGIN = original.ATXFINANCE_BACKEND_ORIGIN;
  });

  beforeEach(() => {
    delete process.env.ATXFINANCE_BACKEND_ORIGIN;
  });

  it("is always false (Next owns personas HTTP)", () => {
    expect(shouldProxyPersonasRequestsToBackend()).toBe(false);
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.internal");
    expect(shouldProxyPersonasRequestsToBackend()).toBe(false);
  });
});
