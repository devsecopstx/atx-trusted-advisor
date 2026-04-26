import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireGlobalAdminSession: vi.fn()
}));

const mongoMocks = vi.hoisted(() => ({
  getDb: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/lib/mongodb", () => mongoMocks);
vi.mock("@/modules/audit/repository", () => auditMocks);

import { PATCH as patchRole } from "@/app/api/admin/tenants/[tenantId]/roles/[role]/route";
import { GET as getRoles, PUT as putRoles } from "@/app/api/admin/tenants/[tenantId]/roles/route";

describe("admin tenant roles api", () => {
  const findOne = vi.fn();
  const findOneAndUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireGlobalAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      email: "admin@example.com",
      username: "admin",
      roles: ["global_admin"],
      tenantId: "507f1f77bcf86cd799439012"
    });
    findOne.mockResolvedValue({
      slug: "acme",
      name: "Acme",
      tenantRoles: {
        viewer: {
          allowedRoutes: ["/portfolios", "/watchlist", "/xoptions", "/account"],
          defaultLanding: "/portfolios",
          flags: {
            canMutatePortfolios: false,
            canUseXChat: false,
            canRunTasks: false
          }
        }
      }
    });
    findOneAndUpdate.mockResolvedValue({
      slug: "acme",
      name: "Acme"
    });
    mongoMocks.getDb.mockResolvedValue({
      collection: () => ({
        findOne,
        findOneAndUpdate
      })
    });
    auditMocks.createAuditEvent.mockResolvedValue({ _id: "1" });
  });

  it("returns tenant role policy matrix", async () => {
    const res = await getRoles(new Request("http://test"), {
      params: Promise.resolve({ tenantId: "507f1f77bcf86cd799439022" })
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { tenantId: string; roles: Record<string, { defaultLanding: string }> };
    };
    expect(body.data.tenantId).toBe("507f1f77bcf86cd799439022");
    expect(body.data.roles.viewer.defaultLanding).toBe("/portfolios");
  });

  it("replaces full tenant roles matrix", async () => {
    const res = await putRoles(
      new Request("http://test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roles: {
            global_admin: {
              allowedRoutes: ["/admin", "/xchat", "/portfolios"],
              defaultLanding: "/admin",
              flags: {
                canMutatePortfolios: true,
                canUseXChat: true,
                canRunTasks: true
              }
            },
            advisor: {
              allowedRoutes: ["/xchat", "/portfolios", "/watchlist", "/xoptions", "/account"],
              defaultLanding: "/xchat",
              flags: {
                canMutatePortfolios: false,
                canUseXChat: true,
                canRunTasks: false
              }
            },
            operator: {
              allowedRoutes: ["/xchat", "/portfolios", "/watchlist", "/xoptions", "/account"],
              defaultLanding: "/portfolios",
              flags: {
                canMutatePortfolios: true,
                canUseXChat: true,
                canRunTasks: true
              }
            },
            viewer: {
              allowedRoutes: ["/portfolios", "/watchlist", "/xoptions", "/account"],
              defaultLanding: "/portfolios",
              flags: {
                canMutatePortfolios: false,
                canUseXChat: false,
                canRunTasks: false
              }
            }
          }
        })
      }),
      {
        params: Promise.resolve({ tenantId: "507f1f77bcf86cd799439022" })
      }
    );
    expect(res.status).toBe(200);
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(auditMocks.createAuditEvent).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid viewer mutate privileges on patch", async () => {
    const res = await patchRole(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flags: { canMutatePortfolios: true }
        })
      }),
      {
        params: Promise.resolve({ tenantId: "507f1f77bcf86cd799439022", role: "viewer" })
      }
    );
    expect(res.status).toBe(400);
  });

  it("passes through forbidden response", async () => {
    authMocks.requireGlobalAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const res = await getRoles(new Request("http://test"), {
      params: Promise.resolve({ tenantId: "507f1f77bcf86cd799439022" })
    });
    expect(res.status).toBe(403);
  });
});
