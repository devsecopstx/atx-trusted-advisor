import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireGlobalAdminSession: vi.fn()
}));
const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn()
}));
const policyCacheMocks = vi.hoisted(() => ({
  bustTenantUxPolicyCacheForTenant: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/audit/repository", () => auditMocks);
vi.mock("@/modules/platform/tenant-ux-policy-cache", () => policyCacheMocks);

import { POST } from "@/app/api/admin/tenants/[tenantId]/policy-cache/route";

describe("POST /api/admin/tenants/[tenantId]/policy-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireGlobalAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      email: "admin@example.com",
      username: "admin",
      roles: ["global_admin"]
    });
    policyCacheMocks.bustTenantUxPolicyCacheForTenant.mockResolvedValue({
      redisDeleted: 7,
      memoryDeleted: 3
    });
    auditMocks.createAuditEvent.mockResolvedValue({ _id: "audit1" });
  });

  it("busts tenant policy cache and writes audit", async () => {
    const res = await POST(new Request("http://test"), {
      params: Promise.resolve({ tenantId: "507f1f77bcf86cd799439022" })
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { tenantId: string; redisDeleted: number; memoryDeleted: number } };
    expect(body.data.tenantId).toBe("507f1f77bcf86cd799439022");
    expect(body.data.redisDeleted).toBe(7);
    expect(body.data.memoryDeleted).toBe(3);
    expect(policyCacheMocks.bustTenantUxPolicyCacheForTenant).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439022",
      "manual_bust"
    );
    expect(auditMocks.createAuditEvent).toHaveBeenCalledTimes(1);
  });

  it("passes through non-admin response", async () => {
    authMocks.requireGlobalAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const res = await POST(new Request("http://test"), {
      params: Promise.resolve({ tenantId: "507f1f77bcf86cd799439022" })
    });
    expect(res.status).toBe(403);
  });
});
