import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const identityMocks = vi.hoisted(() => ({
  getCoreUserById: vi.fn()
}));

const stripeMocks = vi.hoisted(() => ({
  create: vi.fn()
}));

vi.mock("@/lib/auth", () => ({
  requireSessionUser: auth.requireSessionUser
}));

vi.mock("@/modules/identity/repository", () => ({
  getCoreUserById: identityMocks.getCoreUserById
}));

vi.mock("stripe", () => ({
  default: class StripeMock {
    billingPortal = {
      sessions: {
        create: stripeMocks.create
      }
    };
  }
}));

import { POST as postPortalSession } from "@/app/api/billing/portal-session/route";

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

describe("POST /api/billing/portal-session", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    auth.requireSessionUser.mockReset();
    auth.requireSessionUser.mockResolvedValue(sessionUser);
    identityMocks.getCoreUserById.mockReset();
    stripeMocks.create.mockReset();
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("returns 401 when there is no session", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    auth.requireSessionUser.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await postPortalSession();
    expect(res.status).toBe(401);
  });

  it("returns 503 when STRIPE_SECRET_KEY is unset", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const res = await postPortalSession();
    expect(res.status).toBe(503);
  });

  it("returns 400 when user has no stripeCustomerId", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    identityMocks.getCoreUserById.mockResolvedValueOnce({
      email: "u@test",
      roles: ["viewer"],
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const res = await postPortalSession();
    expect(res.status).toBe(400);
  });

  it("returns portal URL when customer is on file", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.APP_BASE_URL = "https://app.example.test";
    identityMocks.getCoreUserById.mockResolvedValueOnce({
      email: "u@test",
      roles: ["viewer"],
      status: "active",
      stripeCustomerId: "cus_abc",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    stripeMocks.create.mockResolvedValueOnce({ url: "https://billing.stripe.com/session/test" });
    const res = await postPortalSession();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url?: string };
    expect(body.url).toBe("https://billing.stripe.com/session/test");
    expect(stripeMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_abc",
        return_url: expect.stringContaining("/account/billing")
      })
    );
  });
});
