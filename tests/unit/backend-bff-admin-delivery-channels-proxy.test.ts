import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { shouldProxyAdminDeliveryChannelsToBackend } from "@/lib/backend-bff";

describe("shouldProxyAdminDeliveryChannelsToBackend", () => {
  const original = { ...process.env };

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.ATXFINANCE_BACKEND_ORIGIN = original.ATXFINANCE_BACKEND_ORIGIN;
    process.env.ATXFINANCE_BACKEND_PROXY_DELIVERY_CHANNELS = original.ATXFINANCE_BACKEND_PROXY_DELIVERY_CHANNELS;
    process.env.ATXFINANCE_BACKEND_PROXY_ADMIN_USERS = original.ATXFINANCE_BACKEND_PROXY_ADMIN_USERS;
  });

  beforeEach(() => {
    delete process.env.ATXFINANCE_BACKEND_ORIGIN;
    delete process.env.ATXFINANCE_BACKEND_PROXY_DELIVERY_CHANNELS;
    delete process.env.ATXFINANCE_BACKEND_PROXY_ADMIN_USERS;
    vi.stubEnv("NODE_ENV", "development");
  });

  it("returns false when backend origin is unset", () => {
    expect(shouldProxyAdminDeliveryChannelsToBackend()).toBe(false);
  });

  it("returns false for loopback in development when flag unset", () => {
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "http://127.0.0.1:8080");
    expect(shouldProxyAdminDeliveryChannelsToBackend()).toBe(false);
  });

  it("returns true for loopback when ATXFINANCE_BACKEND_PROXY_DELIVERY_CHANNELS=true", () => {
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "http://127.0.0.1:8080");
    vi.stubEnv("ATXFINANCE_BACKEND_PROXY_DELIVERY_CHANNELS", "true");
    expect(shouldProxyAdminDeliveryChannelsToBackend()).toBe(true);
  });

  it("returns true for non-loopback when flag unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.internal:8080");
    expect(shouldProxyAdminDeliveryChannelsToBackend()).toBe(true);
  });

  it("when DELIVERY_CHANNELS unset, follows ATXFINANCE_BACKEND_PROXY_ADMIN_USERS=false on remote", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.internal:8080");
    vi.stubEnv("ATXFINANCE_BACKEND_PROXY_ADMIN_USERS", "false");
    expect(shouldProxyAdminDeliveryChannelsToBackend()).toBe(false);
  });
});
