import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireGlobalAdminSession: vi.fn()
}));

const repoMocks = vi.hoisted(() => ({
  getTenantByHexId: vi.fn(),
  getCoreUserById: vi.fn(),
  upsertTenantMembership: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/identity/repository", () => repoMocks);

import { POST } from "@/app/api/admin/tenants/[tenantId]/memberships/route";

describe("POST /api/admin/tenants/[tenantId]/memberships", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireGlobalAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"]
    });
    repoMocks.getTenantByHexId.mockResolvedValue({
      _id: new ObjectId("507f1f77bcf86cd799439022"),
      slug: "acme"
    });
    repoMocks.getCoreUserById.mockResolvedValue({
      _id: new ObjectId("507f1f77bcf86cd799439033"),
      email: "user@example.com"
    });
    repoMocks.upsertTenantMembership.mockResolvedValue({
      role: "tenant_admin",
      isDefaultTenant: true
    });
  });

  it("assigns a tenant role for a user", async () => {
    const res = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "507f1f77bcf86cd799439033",
          tenantRole: "tenant_admin"
        })
      }),
      { params: Promise.resolve({ tenantId: "507f1f77bcf86cd799439022" }) }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { role: string; isDefaultTenant: boolean } };
    expect(body.data.role).toBe("tenant_admin");
    expect(body.data.isDefaultTenant).toBe(true);
    expect(repoMocks.upsertTenantMembership).toHaveBeenCalledTimes(1);
  });

  it("passes through forbidden response", async () => {
    authMocks.requireGlobalAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const res = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "507f1f77bcf86cd799439033",
          tenantRole: "member"
        })
      }),
      { params: Promise.resolve({ tenantId: "507f1f77bcf86cd799439022" }) }
    );
    expect(res.status).toBe(403);
  });
});
