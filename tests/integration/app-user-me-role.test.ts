import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireApprovedAppUserSession: vi.fn()
}));

const routePolicyMocks = vi.hoisted(() => ({
  getTenantRoutePolicyForSession: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/platform/tenant-route-policy", () => routePolicyMocks);

import { GET } from "@/app/api/app-user/me/role/route";

describe("app-user me role endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireApprovedAppUserSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["viewer"]
    });
    routePolicyMocks.getTenantRoutePolicyForSession.mockResolvedValue({
      role: "viewer",
      routeOverrides: {},
      defaultLandingPathByRole: {},
      tenantRoles: {},
      effectiveRolePolicy: {
        allowedRoutes: ["/portfolio", "/portfolios", "/watchlist", "/xoptions", "/account"],
        defaultLanding: "/portfolios",
        flags: {
          canMutatePortfolios: false,
          canUseXChat: false,
          canRunTasks: false
        }
      }
    });
  });

  it("returns effective role policy for session", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { platformRole: string; defaultLanding: string; flags: { canUseXChat: boolean } };
    };
    expect(body.data.platformRole).toBe("viewer");
    expect(body.data.defaultLanding).toBe("/portfolios");
    expect(body.data.flags.canUseXChat).toBe(false);
  });

  it("passes through auth response", async () => {
    authMocks.requireApprovedAppUserSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
