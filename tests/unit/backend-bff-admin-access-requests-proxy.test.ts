import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { shouldProxyAdminAccessRequestsToBackend } from "@/lib/backend-bff";

describe("shouldProxyAdminAccessRequestsToBackend", () => {
  const original = { ...process.env };

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.ATXFINANCE_BACKEND_ORIGIN = original.ATXFINANCE_BACKEND_ORIGIN;
    process.env.ATXFINANCE_BACKEND_PROXY_ACCESS_REQUESTS = original.ATXFINANCE_BACKEND_PROXY_ACCESS_REQUESTS;
    process.env.ATXFINANCE_BACKEND_PROXY_ADMIN_USERS = original.ATXFINANCE_BACKEND_PROXY_ADMIN_USERS;
  });

  beforeEach(() => {
    delete process.env.ATXFINANCE_BACKEND_ORIGIN;
    delete process.env.ATXFINANCE_BACKEND_PROXY_ACCESS_REQUESTS;
    delete process.env.ATXFINANCE_BACKEND_PROXY_ADMIN_USERS;
    vi.stubEnv("NODE_ENV", "development");
  });

  it("returns false when backend origin is unset", () => {
    expect(shouldProxyAdminAccessRequestsToBackend()).toBe(false);
  });

  it("returns false for loopback in development when flags unset", () => {
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "http://127.0.0.1:8080");
    expect(shouldProxyAdminAccessRequestsToBackend()).toBe(false);
  });

  it("returns true for non-loopback production when flags unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.internal:8080");
    expect(shouldProxyAdminAccessRequestsToBackend()).toBe(true);
  });

  it("when ACCESS_REQUESTS unset, follows ATXFINANCE_BACKEND_PROXY_ADMIN_USERS=false on remote", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.internal:8080");
    vi.stubEnv("ATXFINANCE_BACKEND_PROXY_ADMIN_USERS", "false");
    expect(shouldProxyAdminAccessRequestsToBackend()).toBe(false);
  });
});
