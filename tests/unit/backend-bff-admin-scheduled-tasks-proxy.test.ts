import { afterEach, describe, expect, it, vi } from "vitest";

import { shouldProxyAdminScheduledTasksToBackend } from "@/lib/backend-bff";

describe("shouldProxyAdminScheduledTasksToBackend", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is always false (Next owns admin scheduled-task HTTP; no env)", () => {
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "https://backend.example.internal");
    vi.stubEnv("NODE_ENV", "production");
    expect(shouldProxyAdminScheduledTasksToBackend()).toBe(false);
  });
});
