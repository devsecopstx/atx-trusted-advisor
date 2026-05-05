import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const policyCacheMocks = vi.hoisted(() => ({
  getCachedTenantUxPolicyForSession: vi.fn()
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/modules/platform/tenant-ux-policy-cache", () => policyCacheMocks);

import { GET } from "@/app/api/internal/tenant-ux/policy/route";

describe("internal tenant ux policy route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireSessionUser.mockResolvedValue({
      userId: "u1",
      tenantId: "t1",
      roles: ["viewer"]
    });
    policyCacheMocks.getCachedTenantUxPolicyForSession.mockResolvedValue({
      role: "viewer",
      userId: "u1",
      tenantId: "t1",
      allowedRoutes: [
        "/portfolio",
        "/portfolios",
        "/watchlist",
        "/xoptions",
        "/account",
        "/xchat",
        "/xcoach"
      ],
      defaultLanding: "/xchat",
      flags: {
        canMutatePortfolios: false,
        canUseXChat: false,
        canRunTasks: false
      }
    });
  });

  it("returns allowed false for disallowed path", async () => {
    const res = await GET(new Request("http://test/api/internal/tenant-ux/policy?pathname=/admin"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { allowed: boolean; redirectPath: string } };
    expect(body.data.allowed).toBe(false);
    expect(body.data.redirectPath).toBe("/xchat");
  });

  it("returns allowed true for permitted paths including xcoach", async () => {
    const chat = await GET(new Request("http://test/api/internal/tenant-ux/policy?pathname=/xchat"));
    expect(chat.status).toBe(200);
    expect(((await chat.json()) as { data: { allowed: boolean } }).data.allowed).toBe(true);
    const coach = await GET(new Request("http://test/api/internal/tenant-ux/policy?pathname=/xcoach"));
    expect(coach.status).toBe(200);
    expect(((await coach.json()) as { data: { allowed: boolean } }).data.allowed).toBe(true);
  });

  it("passes through unauthorized responses", async () => {
    authMocks.requireSessionUser.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await GET(new Request("http://test/api/internal/tenant-ux/policy?pathname=/xchat"));
    expect(res.status).toBe(401);
  });
});
