import { describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@/lib/auth";
import { resolveSessionLandingPath, subscriberLandingPathForPlan } from "@/lib/default-landing-path";

vi.mock("@/modules/platform/tenant-route-policy", () => ({
  getTenantRoutePolicyForSession: vi.fn(async () => null)
}));

vi.mock("@/modules/identity/repository", () => ({
  getCoreUserById: vi.fn(async () => ({ subscriptionPlan: "enterprise" }))
}));

describe("default-landing-path", () => {
  it("subscriberLandingPathForPlan always returns /xchat regardless of plan", () => {
    expect(subscriberLandingPathForPlan("basic")).toBe("/xchat");
    expect(subscriberLandingPathForPlan("enterprise")).toBe("/xchat");
    expect(subscriberLandingPathForPlan(undefined)).toBe("/xchat");
  });

  it("resolveSessionLandingPath sends global_admin to /admin", async () => {
    const session = {
      userId: "507f1f77bcf86cd799439011",
      roles: ["global_admin"],
      tenantId: "507f1f77bcf86cd799439011"
    } as unknown as SessionUser;
    await expect(resolveSessionLandingPath(session)).resolves.toBe("/admin");
  });

  it("resolveSessionLandingPath uses xchat for non-admin when tenant policy has no defaultLanding", async () => {
    const session = {
      userId: "507f1f77bcf86cd799439011",
      roles: ["operator"],
      tenantId: "507f1f77bcf86cd799439011"
    } as unknown as SessionUser;
    await expect(resolveSessionLandingPath(session)).resolves.toBe("/xchat");
  });
});
