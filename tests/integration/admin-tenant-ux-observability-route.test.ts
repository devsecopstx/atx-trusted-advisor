import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireGlobalAdminSession: vi.fn()
}));
const observabilityMocks = vi.hoisted(() => ({
  listTenantUxObservabilityEvents: vi.fn(),
  listTenantUxObservabilityReplay: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/platform/tenant-ux-observability-repository", () => observabilityMocks);

import { GET } from "@/app/api/admin/platform/tenant-ux/observability/route";

describe("GET /api/admin/platform/tenant-ux/observability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireGlobalAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      roles: ["global_admin"]
    });
    observabilityMocks.listTenantUxObservabilityEvents.mockResolvedValue([
      {
        type: "tenant_ux_metric",
        tenantId: "507f1f77bcf86cd799439022",
        metric: "tenant_ux_route_forbidden_total",
        ms: 14,
        createdAt: new Date()
      }
    ]);
    observabilityMocks.listTenantUxObservabilityReplay.mockResolvedValue([]);
  });

  it("returns counters + recent events", async () => {
    const res = await GET(new Request("http://test"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { counters: { tenant_ux_route_forbidden_total: number } } };
    expect(body.data.counters.tenant_ux_route_forbidden_total).toBe(1);
    expect(observabilityMocks.listTenantUxObservabilityEvents).toHaveBeenCalledWith({
      tenantId: undefined,
      limit: 50
    });
  });

  it("passes through forbidden response", async () => {
    authMocks.requireGlobalAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const res = await GET(new Request("http://test"));
    expect(res.status).toBe(403);
  });
});
