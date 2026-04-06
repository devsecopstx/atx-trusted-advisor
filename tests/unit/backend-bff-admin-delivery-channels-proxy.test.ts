import { afterEach, describe, expect, it, vi } from "vitest";

import { shouldProxyAdminDeliveryChannelsToBackend } from "@/lib/backend-bff";

describe("shouldProxyAdminDeliveryChannelsToBackend", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is always false (Next owns admin delivery-channel HTTP; no env)", () => {
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.internal");
    vi.stubEnv("NODE_ENV", "production");
    expect(shouldProxyAdminDeliveryChannelsToBackend()).toBe(false);
  });
});
