import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const identityMocks = vi.hoisted(() => ({
  listTenantRegisterForAdmin: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/identity/repository", () => identityMocks);
vi.mock("@/lib/backend-bff", () => ({
  proxyAdminUsersRequestToBackend: vi.fn().mockResolvedValue(null)
}));

import { GET as getTenantRegister } from "@/app/api/admin/tenants/register/route";

describe("GET /api/admin/tenants/register", () => {
  beforeEach(() => {
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"]
    });
    identityMocks.listTenantRegisterForAdmin.mockResolvedValue([
      {
        tenantId: "507f1f77bcf86cd7994390aa",
        slug: "acme",
        name: "Acme Fund",
        isPlatformDefault: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        workspaceLimits: { userChatLimit: 25 },
        tenantPreferences: { xf_ui_theme: "light", xchat_brandname: "Acme xChat" },
        tenantAdmins: [
          {
            userId: "507f1f77bcf86cd7994390bb",
            email: "admin@acme.test",
            displayName: "Acme Admin",
            isDefaultSessionTenant: true
          }
        ]
      }
    ]);
  });

  it("returns tenant register rows for global_admin", async () => {
    const response = await getTenantRegister(new Request("http://test/api/admin/tenants/register"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: Array<{
        tenantId: string;
        slug: string;
        workspaceLimits: unknown;
        tenantPreferences: unknown;
        tenantAdmins: unknown[];
      }>;
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.slug).toBe("acme");
    expect(body.data[0]?.workspaceLimits).toEqual({ userChatLimit: 25 });
    expect(body.data[0]?.tenantPreferences).toMatchObject({ xf_ui_theme: "light" });
    expect(body.data[0]?.tenantAdmins).toHaveLength(1);
    expect(identityMocks.listTenantRegisterForAdmin).toHaveBeenCalledTimes(1);
  });

  it("returns 403 when not global_admin", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const response = await getTenantRegister(new Request("http://test/api/admin/tenants/register"));
    expect(response.status).toBe(403);
    expect(identityMocks.listTenantRegisterForAdmin).not.toHaveBeenCalled();
  });
});
