import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const tenantCache = vi.hoisted(() => ({
  getTenantByHexIdCached: vi.fn().mockResolvedValue(null)
}));

const identityRepoMocks = vi.hoisted(() => ({
  getCoreUserById: vi.fn().mockResolvedValue(null),
  resolveTenantIdHexForGlobalAdminConsole: vi.fn().mockResolvedValue(null)
}));

vi.mock("@/lib/auth", () => ({
  requireSessionUser: auth.requireSessionUser
}));

vi.mock("@/lib/server-request-cache", () => ({
  getTenantByHexIdCached: tenantCache.getTenantByHexIdCached
}));

vi.mock("@/modules/identity/repository", () => identityRepoMocks);

import { POST as postCheckoutSession } from "@/app/api/billing/checkout-session/route";

const sessionUser = {
  userId: "507f1f77bcf86cd799439011",
  email: "user@test.local",
  roles: ["advisor"] as const,
  tenantId: "507f1f77bcf86cd799439022",
  tenantRole: "tenant_member" as const,
  xUserId: "x1",
  username: "t",
  displayName: "T",
  avatarUrl: null as string | null
};

describe("POST /api/billing/checkout-session", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    auth.requireSessionUser.mockReset();
    auth.requireSessionUser.mockResolvedValue(sessionUser);
    tenantCache.getTenantByHexIdCached.mockReset();
    tenantCache.getTenantByHexIdCached.mockResolvedValue(null);
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("returns 401 when there is no session", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    auth.requireSessionUser.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const req = new Request("http://test/api/billing/checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "basic" })
    });
    const res = await postCheckoutSession(req);
    expect(res.status).toBe(401);
  });

  it("returns 503 when STRIPE_SECRET_KEY is unset", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const req = new Request("http://test/api/billing/checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "basic" })
    });
    const res = await postCheckoutSession(req);
    expect(res.status).toBe(503);
  });

  it("returns 503 when price id for plan is unset", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    delete process.env.STRIPE_PRICE_BASIC_MONTHLY;
    const req = new Request("http://test/api/billing/checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "basic" })
    });
    const res = await postCheckoutSession(req);
    expect(res.status).toBe(503);
  });

});
