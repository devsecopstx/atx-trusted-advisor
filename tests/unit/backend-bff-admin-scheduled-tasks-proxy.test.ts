import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { shouldProxyAdminScheduledTasksToBackend } from "@/lib/backend-bff";

describe("shouldProxyAdminScheduledTasksToBackend", () => {
  const original = { ...process.env };

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.ATXFINANCE_BACKEND_ORIGIN = original.ATXFINANCE_BACKEND_ORIGIN;
    process.env.ATXFINANCE_BACKEND_PROXY_SCHEDULED_TASKS = original.ATXFINANCE_BACKEND_PROXY_SCHEDULED_TASKS;
    process.env.ATXFINANCE_BACKEND_PROXY_ADMIN_USERS = original.ATXFINANCE_BACKEND_PROXY_ADMIN_USERS;
  });

  beforeEach(() => {
    delete process.env.ATXFINANCE_BACKEND_ORIGIN;
    delete process.env.ATXFINANCE_BACKEND_PROXY_SCHEDULED_TASKS;
    delete process.env.ATXFINANCE_BACKEND_PROXY_ADMIN_USERS;
    vi.stubEnv("NODE_ENV", "development");
  });

  it("returns false when backend origin is unset", () => {
    expect(shouldProxyAdminScheduledTasksToBackend()).toBe(false);
  });

  it("returns false for loopback origin in development when flag unset (Admin → Tasks uses Next Mongo)", () => {
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "http://127.0.0.1:8080");
    expect(shouldProxyAdminScheduledTasksToBackend()).toBe(false);
  });

  it("returns true for loopback when ATXFINANCE_BACKEND_PROXY_SCHEDULED_TASKS=true", () => {
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "http://127.0.0.1:8080");
    vi.stubEnv("ATXFINANCE_BACKEND_PROXY_SCHEDULED_TASKS", "true");
    expect(shouldProxyAdminScheduledTasksToBackend()).toBe(true);
  });

  it("returns true for non-loopback origin when flag unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.internal:8080");
    expect(shouldProxyAdminScheduledTasksToBackend()).toBe(true);
  });

  it("returns false for non-loopback when ATXFINANCE_BACKEND_PROXY_SCHEDULED_TASKS=false", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.internal:8080");
    vi.stubEnv("ATXFINANCE_BACKEND_PROXY_SCHEDULED_TASKS", "false");
    expect(shouldProxyAdminScheduledTasksToBackend()).toBe(false);
  });

  it("when SCHEDULED_TASKS unset, follows ATXFINANCE_BACKEND_PROXY_ADMIN_USERS=false on remote", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.internal:8080");
    vi.stubEnv("ATXFINANCE_BACKEND_PROXY_ADMIN_USERS", "false");
    expect(shouldProxyAdminScheduledTasksToBackend()).toBe(false);
  });

  it("explicit ATXFINANCE_BACKEND_PROXY_SCHEDULED_TASKS=true overrides ADMIN_USERS=false", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.internal:8080");
    vi.stubEnv("ATXFINANCE_BACKEND_PROXY_ADMIN_USERS", "false");
    vi.stubEnv("ATXFINANCE_BACKEND_PROXY_SCHEDULED_TASKS", "true");
    expect(shouldProxyAdminScheduledTasksToBackend()).toBe(true);
  });
});
