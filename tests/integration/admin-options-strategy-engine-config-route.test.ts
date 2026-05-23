import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireGlobalAdminSession: vi.fn()
}));

const tenantCacheMocks = vi.hoisted(() => ({
  getTenantByHexIdCached: vi.fn()
}));

const identityMocks = vi.hoisted(() => ({
  updateTenantOptionsStrategyEngineConfig: vi.fn()
}));

vi.mock("@/lib/api-auth", () => ({
  requireGlobalAdminSession: authMocks.requireGlobalAdminSession
}));

vi.mock("@/lib/server-request-cache", () => ({
  getTenantByHexIdCached: tenantCacheMocks.getTenantByHexIdCached
}));

vi.mock("@/modules/audit/repository", () => ({
  createAuditEvent: vi.fn(() => Promise.resolve(undefined))
}));

vi.mock("@/modules/identity/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/identity/repository")>();
  return {
    ...actual,
    updateTenantOptionsStrategyEngineConfig: identityMocks.updateTenantOptionsStrategyEngineConfig
  };
});

import { GET, PATCH } from "@/app/api/admin/tenants/[tenantId]/options-strategy-engine-config/route";

const TENANT_HEX = "507f1f77bcf86cd799439022";

const storedConfig = {
  overrideEnabled: true,
  scanner: { minIvRankPct: 50, minDte: 21, maxDte: 45 },
  engine: { straddleDeltaMin: 0.15, straddleDeltaMax: 0.3, minFitScore: 72 }
};

describe("GET/PATCH /api/admin/tenants/[tenantId]/options-strategy-engine-config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireGlobalAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: TENANT_HEX,
      email: "admin@atxfinance.ai",
      roles: ["global_admin"],
      tenantRole: "tenant_admin"
    });
    tenantCacheMocks.getTenantByHexIdCached.mockResolvedValue({
      _id: { toHexString: () => TENANT_HEX },
      slug: "acme",
      name: "Acme",
      tenantPreferences: { options_strategy_engine: storedConfig },
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    identityMocks.updateTenantOptionsStrategyEngineConfig.mockResolvedValue({
      _id: { toHexString: () => TENANT_HEX },
      slug: "acme",
      name: "Acme",
      tenantPreferences: { options_strategy_engine: storedConfig },
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  it("GET returns effective engine config", async () => {
    const res = await GET(new Request("http://test"), {
      params: Promise.resolve({ tenantId: TENANT_HEX })
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { overrideEnabled: boolean; effective: { scanner: { minIvRankPct: number } } };
    };
    expect(json.data.overrideEnabled).toBe(true);
    expect(json.data.effective.scanner.minIvRankPct).toBe(50);
  });

  it("PATCH saves valid config", async () => {
    const res = await PATCH(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionsStrategyEngineConfig: storedConfig })
      }),
      { params: Promise.resolve({ tenantId: TENANT_HEX }) }
    );
    expect(res.status).toBe(200);
    expect(identityMocks.updateTenantOptionsStrategyEngineConfig).toHaveBeenCalled();
  });

  it("PATCH rejects invalid delta band", async () => {
    const res = await PATCH(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optionsStrategyEngineConfig: {
            engine: { straddleDeltaMin: 0.5, straddleDeltaMax: 0.2 }
          }
        })
      }),
      { params: Promise.resolve({ tenantId: TENANT_HEX }) }
    );
    expect(res.status).toBe(400);
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
