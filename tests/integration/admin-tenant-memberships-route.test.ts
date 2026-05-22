import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireGlobalAdminSession: vi.fn()
}));

const repoMocks = vi.hoisted(() => ({
  getTenantByHexId: vi.fn(),
  getCoreUserById: vi.fn(),
  upsertTenantMembership: vi.fn(),
  listTenantMembershipsForAdmin: vi.fn(),
  tenantHasAdminMembership: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/identity/repository", () => repoMocks);

import { GET, POST } from "@/app/api/admin/tenants/[tenantId]/memberships/route";

const TENANT_HEX = "507f1f77bcf86cd799439022";
const USER_HEX = "507f1f77bcf86cd799439033";

describe("GET/POST /api/admin/tenants/[tenantId]/memberships", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireGlobalAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: TENANT_HEX,
      roles: ["global_admin"]
    });
    repoMocks.getTenantByHexId.mockResolvedValue({
      _id: new ObjectId(TENANT_HEX),
      slug: "acme"
    });
    repoMocks.getCoreUserById.mockResolvedValue({
      _id: new ObjectId(USER_HEX),
      email: "user@example.com"
    });
    repoMocks.upsertTenantMembership.mockResolvedValue({
      role: "tenant_admin",
      isDefaultTenant: true
    });
    repoMocks.listTenantMembershipsForAdmin.mockResolvedValue([
      {
        userId: USER_HEX,
        email: "user@example.com",
        displayName: "user@example.com",
        tenantRole: "tenant_admin",
        isDefaultSessionTenant: true,
        isTenantAdmin: true
      }
    ]);
    repoMocks.tenantHasAdminMembership.mockResolvedValue(true);
  });

  it("GET lists tenant admins and membership flag", async () => {
    const res = await GET(new Request("http://test"), {
      params: Promise.resolve({ tenantId: TENANT_HEX })
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { hasTenantAdmin: boolean; tenantAdmins: Array<{ userId: string }> };
    };
    expect(body.data.hasTenantAdmin).toBe(true);
    expect(body.data.tenantAdmins).toHaveLength(1);
    expect(body.data.tenantAdmins[0]?.userId).toBe(USER_HEX);
  });

  it("POST assigns a tenant role for a user", async () => {
    const res = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: USER_HEX,
          tenantRole: "tenant_admin"
        })
      }),
      { params: Promise.resolve({ tenantId: TENANT_HEX }) }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { role: string; isDefaultTenant: boolean; hasTenantAdmin: boolean };
    };
    expect(body.data.role).toBe("tenant_admin");
    expect(body.data.isDefaultTenant).toBe(true);
    expect(body.data.hasTenantAdmin).toBe(true);
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
          userId: USER_HEX,
          tenantRole: "member"
        })
      }),
      { params: Promise.resolve({ tenantId: TENANT_HEX }) }
    );
    expect(res.status).toBe(403);
  });
});
