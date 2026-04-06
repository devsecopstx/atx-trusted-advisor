import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    shouldProxyAdminUsersToBackend,
    shouldProxyPortfolioRequestsToBackend
} from "@/lib/backend-bff";

describe("shouldProxyAdminUsersToBackend", () => {
  const original = { ...process.env };

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.ATXFINANCE_BACKEND_ORIGIN = original.ATXFINANCE_BACKEND_ORIGIN;
    process.env.ATXFINANCE_BACKEND_PROXY_ADMIN_USERS = original.ATXFINANCE_BACKEND_PROXY_ADMIN_USERS;
  });

  beforeEach(() => {
    delete process.env.ATXFINANCE_BACKEND_ORIGIN;
    delete process.env.ATXFINANCE_BACKEND_PROXY_ADMIN_USERS;
    vi.stubEnv("NODE_ENV", "development");
  });

  it("returns false when backend origin is unset", () => {
    expect(shouldProxyAdminUsersToBackend()).toBe(false);
  });

  it("returns false for loopback origin in development when flag unset (Manage Users → Next Mongo)", () => {
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "http://127.0.0.1:8080");
    expect(shouldProxyAdminUsersToBackend()).toBe(false);
  });

  it("returns true for loopback when ATXFINANCE_BACKEND_PROXY_ADMIN_USERS=true", () => {
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "http://127.0.0.1:8080");
    vi.stubEnv("ATXFINANCE_BACKEND_PROXY_ADMIN_USERS", "true");
    expect(shouldProxyAdminUsersToBackend()).toBe(true);
  });

  it("returns true for non-loopback origin when flag unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.internal:8080");
    expect(shouldProxyAdminUsersToBackend()).toBe(true);
  });

  it("returns false when proxy is explicitly off", () => {
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.internal:8080");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATXFINANCE_BACKEND_PROXY_ADMIN_USERS", "false");
    expect(shouldProxyAdminUsersToBackend()).toBe(false);
    vi.stubEnv("ATXFINANCE_BACKEND_PROXY_ADMIN_USERS", "0");
    expect(shouldProxyAdminUsersToBackend()).toBe(false);
  });

  it("shouldProxyPortfolioRequestsToBackend matches shouldProxyAdminUsersToBackend (shared ATXFINANCE_BACKEND_PROXY_ADMIN_USERS gate)", () => {
    expect(shouldProxyPortfolioRequestsToBackend()).toBe(shouldProxyAdminUsersToBackend());
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "http://127.0.0.1:8080");
    expect(shouldProxyPortfolioRequestsToBackend()).toBe(shouldProxyAdminUsersToBackend());
    vi.stubEnv("ATXFINANCE_BACKEND_PROXY_ADMIN_USERS", "true");
    expect(shouldProxyPortfolioRequestsToBackend()).toBe(shouldProxyAdminUsersToBackend());
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.internal:8080");
    vi.stubEnv("ATXFINANCE_BACKEND_PROXY_ADMIN_USERS", "false");
    expect(shouldProxyPortfolioRequestsToBackend()).toBe(shouldProxyAdminUsersToBackend());
  });
});
