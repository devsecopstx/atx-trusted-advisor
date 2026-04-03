import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { shouldProxyPersonasRequestsToBackend } from "@/lib/backend-bff";

describe("shouldProxyPersonasRequestsToBackend", () => {
  const original = { ...process.env };

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.ATXFINANCE_BACKEND_ORIGIN = original.ATXFINANCE_BACKEND_ORIGIN;
    process.env.ATXFINANCE_BACKEND_PROXY_PERSONAS = original.ATXFINANCE_BACKEND_PROXY_PERSONAS;
  });

  beforeEach(() => {
    delete process.env.ATXFINANCE_BACKEND_ORIGIN;
    delete process.env.ATXFINANCE_BACKEND_PROXY_PERSONAS;
  });

  it("returns false when backend origin is unset", () => {
    expect(shouldProxyPersonasRequestsToBackend()).toBe(false);
  });

  it("returns false when origin is set but ATXFINANCE_BACKEND_PROXY_PERSONAS is unset", () => {
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.internal:8080");
    expect(shouldProxyPersonasRequestsToBackend()).toBe(false);
  });

  it("returns true when origin is set and ATXFINANCE_BACKEND_PROXY_PERSONAS=true", () => {
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.internal:8080");
    vi.stubEnv("ATXFINANCE_BACKEND_PROXY_PERSONAS", "true");
    expect(shouldProxyPersonasRequestsToBackend()).toBe(true);
  });
});
