import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireGlobalAdminSession: vi.fn()
}));

const tenantCacheMocks = vi.hoisted(() => ({
  getTenantByHexIdCached: vi.fn()
}));

const identityMocks = vi.hoisted(() => ({
  updateTenantDefaultPortfolioScoringFactors: vi.fn()
}));

vi.mock("@/lib/api-auth", () => ({
  requireGlobalAdminSession: authMocks.requireGlobalAdminSession,
  requireAdminSession: authMocks.requireGlobalAdminSession
}));

vi.mock("@/lib/server-request-cache", () => ({
  getTenantByHexIdCached: tenantCacheMocks.getTenantByHexIdCached
}));

vi.mock("@/modules/identity/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/identity/repository")>();
  return {
    ...actual,
    updateTenantDefaultPortfolioScoringFactors: identityMocks.updateTenantDefaultPortfolioScoringFactors
  };
});

import { GET, PATCH } from "@/app/api/admin/tenants/[tenantId]/portfolio-scoring-defaults/route";
import type { PortfolioScoringFactorApi } from "@/modules/core-admin/scoring-factors";

const TENANT_HEX = "507f1f77bcf86cd799439022";

const factors = [
  { id: "iv_rank", weight: 0.3 },
  { id: "open_interest", weight: 0.2 },
  { id: "volume", weight: 0.15 },
  { id: "liquidity", weight: 0.1 },
  { id: "portfolio_fit", weight: 0.15 },
  { id: "strategy_alignment", weight: 0.1 }
];

describe("GET/PATCH /api/admin/tenants/[tenantId]/portfolio-scoring-defaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireGlobalAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: TENANT_HEX,
      email: "admin@atxfinance.ai",
      username: "xf-admin",
      roles: ["global_admin"],
      tenantRole: "tenant_admin",
      xUserId: "x1"
    });
    tenantCacheMocks.getTenantByHexIdCached.mockResolvedValue({
      _id: { toHexString: () => TENANT_HEX },
      slug: "acme",
      name: "Acme",
      defaultPortfolioScoringFactors: factors,
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    identityMocks.updateTenantDefaultPortfolioScoringFactors.mockResolvedValue({
      _id: { toHexString: () => TENANT_HEX },
      slug: "acme",
      name: "Acme",
      defaultPortfolioScoringFactors: factors,
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  it("GET returns 404 when tenant missing", async () => {
    tenantCacheMocks.getTenantByHexIdCached.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://test"), {
      params: Promise.resolve({ tenantId: TENANT_HEX })
    });
    expect(res.status).toBe(404);
  });

  it("GET returns scoring payload and hasTenantOverride", async () => {
    const res = await GET(new Request("http://test"), {
      params: Promise.resolve({ tenantId: TENANT_HEX })
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { hasTenantOverride: boolean; scoringFactors: PortfolioScoringFactorApi[] };
    };
    expect(json.data.hasTenantOverride).toBe(true);
    expect(json.data.scoringFactors).toHaveLength(6);
    expect(json.data.scoringFactors[0]?.label).toBeDefined();
  });

  it("PATCH clears when null", async () => {
    tenantCacheMocks.getTenantByHexIdCached.mockResolvedValue({
      _id: { toHexString: () => TENANT_HEX },
      slug: "acme",
      name: "Acme",
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    identityMocks.updateTenantDefaultPortfolioScoringFactors.mockResolvedValue({
      _id: { toHexString: () => TENANT_HEX },
      slug: "acme",
      name: "Acme",
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const res = await PATCH(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultPortfolioScoringFactors: null })
      }),
      { params: Promise.resolve({ tenantId: TENANT_HEX }) }
    );
    expect(res.status).toBe(200);
    expect(identityMocks.updateTenantDefaultPortfolioScoringFactors).toHaveBeenCalledWith(TENANT_HEX, null);
  });

  it("PATCH saves valid factors", async () => {
    const res = await PATCH(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultPortfolioScoringFactors: factors })
      }),
      { params: Promise.resolve({ tenantId: TENANT_HEX }) }
    );
    expect(res.status).toBe(200);
    expect(identityMocks.updateTenantDefaultPortfolioScoringFactors).toHaveBeenCalledWith(TENANT_HEX, factors);
  });

  it("GET returns 403 when not global admin", async () => {
    authMocks.requireGlobalAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const res = await GET(new Request("http://test"), {
      params: Promise.resolve({ tenantId: TENANT_HEX })
    });
    expect(res.status).toBe(403);
  });
});
