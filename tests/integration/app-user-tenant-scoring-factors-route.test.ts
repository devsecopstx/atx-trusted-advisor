import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireApprovedAppUserSession: vi.fn()
}));

const tenantCacheMocks = vi.hoisted(() => ({
  getTenantByHexIdCached: vi.fn()
}));

vi.mock("@/lib/api-auth", () => ({
  requireApprovedAppUserSession: authMocks.requireApprovedAppUserSession
}));

vi.mock("@/lib/server-request-cache", () => ({
  getTenantByHexIdCached: tenantCacheMocks.getTenantByHexIdCached
}));

import { GET } from "@/app/api/app-user/tenant/scoring-factors/route";

const TENANT_HEX = "507f1f77bcf86cd799439022";

describe("GET /api/app-user/tenant/scoring-factors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireApprovedAppUserSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: TENANT_HEX,
      email: "advisor@test.local",
      roles: ["advisor"]
    });
    tenantCacheMocks.getTenantByHexIdCached.mockResolvedValue({
      _id: { toHexString: () => TENANT_HEX },
      slug: "acme-ia",
      name: "Acme IA LLC",
      defaultPortfolioScoringFactors: [{ id: "iv_rank", weight: 0.35 }]
    });
  });

  it("returns read-only tenant scoring factors for the session tenant", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { tenantName: string; hasTenantOverride: boolean; scoringFactors: Array<{ id: string }> };
    };
    expect(body.data.tenantName).toBe("Acme IA LLC");
    expect(body.data.hasTenantOverride).toBe(false);
    expect(body.data.scoringFactors.length).toBeGreaterThan(0);
  });

  it("returns 401 when unauthenticated", async () => {
    authMocks.requireApprovedAppUserSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
