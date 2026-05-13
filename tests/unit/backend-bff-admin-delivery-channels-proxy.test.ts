import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    shouldProxyAdminDeliveryChannelsToBackend,
    shouldProxyAdminUsersToBackend
} from "@/lib/backend-bff";

describe("shouldProxyAdminDeliveryChannelsToBackend", () => {
  const original = { ...process.env };

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.ATXFINANCE_BACKEND_ORIGIN = original.ATXFINANCE_BACKEND_ORIGIN;
  });

  beforeEach(() => {
    delete process.env.ATXFINANCE_BACKEND_ORIGIN;
    vi.stubEnv("NODE_ENV", "development");
  });

  it("matches shouldProxyAdminUsersToBackend in every case", () => {
    expect(shouldProxyAdminDeliveryChannelsToBackend()).toBe(shouldProxyAdminUsersToBackend());

    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "http://127.0.0.1:8080");
    expect(shouldProxyAdminDeliveryChannelsToBackend()).toBe(shouldProxyAdminUsersToBackend());

    vi.stubEnv("NODE_ENV", "production");
    expect(shouldProxyAdminDeliveryChannelsToBackend()).toBe(shouldProxyAdminUsersToBackend());

    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.internal:8080");
    expect(shouldProxyAdminDeliveryChannelsToBackend()).toBe(shouldProxyAdminUsersToBackend());
  });
});
