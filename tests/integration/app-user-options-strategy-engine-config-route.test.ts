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

import { GET } from "@/app/api/app-user/tenant/options-strategy-engine-config/route";

const TENANT_HEX = "507f1f77bcf86cd799439022";

describe("GET /api/app-user/tenant/options-strategy-engine-config", () => {
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
      slug: "acme",
      name: "Acme IA",
      tenantPreferences: {
        options_strategy_engine: {
          overrideEnabled: true,
          scanner: { minIvRankPct: 48 }
        }
      }
    });
  });

  it("returns read-only effective config for app users", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { readOnly: boolean; effective: { scanner: { minIvRankPct: number } } };
    };
    expect(json.data.readOnly).toBe(true);
    expect(json.data.effective.scanner.minIvRankPct).toBe(48);
  });

  it("returns 401 when unauthenticated", async () => {
    authMocks.requireApprovedAppUserSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
