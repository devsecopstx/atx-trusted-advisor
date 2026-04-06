import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    shouldProxyAdminAccessRequestsToBackend,
    shouldProxyAdminUsersToBackend
} from "@/lib/backend-bff";

describe("shouldProxyAdminAccessRequestsToBackend", () => {
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
    expect(shouldProxyAdminAccessRequestsToBackend()).toBe(shouldProxyAdminUsersToBackend());

    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "http://127.0.0.1:8080");
    expect(shouldProxyAdminAccessRequestsToBackend()).toBe(shouldProxyAdminUsersToBackend());

    vi.stubEnv("NODE_ENV", "production");
    expect(shouldProxyAdminAccessRequestsToBackend()).toBe(shouldProxyAdminUsersToBackend());

    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.internal:8080");
    expect(shouldProxyAdminAccessRequestsToBackend()).toBe(shouldProxyAdminUsersToBackend());
  });
});
