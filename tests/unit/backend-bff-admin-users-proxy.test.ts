import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    shouldProxyAdminUsersToBackend,
    shouldProxyAppUserPortfolioWatchlistPatchToBackend,
    shouldProxyAppUserPortfolioWatchlistToBackend,
    shouldProxyPortfolioRequestsToBackend
} from "@/lib/backend-bff";

describe("shouldProxyAdminUsersToBackend", () => {
  const original = { ...process.env };

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.ATXFINANCE_BACKEND_ORIGIN = original.ATXFINANCE_BACKEND_ORIGIN;
  });

  beforeEach(() => {
    delete process.env.ATXFINANCE_BACKEND_ORIGIN;
    vi.stubEnv("NODE_ENV", "development");
  });

  it("returns false when backend origin is unset", () => {
    expect(shouldProxyAdminUsersToBackend()).toBe(false);
  });

  it("returns false for loopback origin in development (Manage Users → Next Mongo)", () => {
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "http://127.0.0.1:8080");
    expect(shouldProxyAdminUsersToBackend()).toBe(false);
  });

  it("returns true for loopback when NODE_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "http://127.0.0.1:8080");
    expect(shouldProxyAdminUsersToBackend()).toBe(true);
  });

  it("returns true for non-loopback origin when NODE_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.internal:8080");
    expect(shouldProxyAdminUsersToBackend()).toBe(true);
  });

  it("returns true for non-loopback origin in development", () => {
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.internal:8080");
    expect(shouldProxyAdminUsersToBackend()).toBe(true);
  });

  it("shouldProxyPortfolioRequestsToBackend matches shouldProxyAdminUsersToBackend", () => {
    expect(shouldProxyPortfolioRequestsToBackend()).toBe(shouldProxyAdminUsersToBackend());
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "http://127.0.0.1:8080");
    expect(shouldProxyPortfolioRequestsToBackend()).toBe(shouldProxyAdminUsersToBackend());
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.internal:8080");
    expect(shouldProxyPortfolioRequestsToBackend()).toBe(shouldProxyAdminUsersToBackend());
  });

  it("shouldProxyAppUserPortfolioWatchlistToBackend is deprecated and stays false", () => {
    expect(shouldProxyAppUserPortfolioWatchlistToBackend()).toBe(false);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.internal:8080");
    expect(shouldProxyAppUserPortfolioWatchlistToBackend()).toBe(false);
  });

  it("shouldProxyAppUserPortfolioWatchlistPatchToBackend matches portfolio gate (PATCH proxies when gate on)", () => {
    expect(shouldProxyAppUserPortfolioWatchlistPatchToBackend()).toBe(false);
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "http://127.0.0.1:8080");
    expect(shouldProxyAppUserPortfolioWatchlistPatchToBackend()).toBe(false);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.internal:8080");
    expect(shouldProxyAppUserPortfolioWatchlistPatchToBackend()).toBe(true);
  });
});
