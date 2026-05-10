import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireGlobalAdminSession: vi.fn()
}));

const mongoMocks = vi.hoisted(() => ({
  getDb: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/lib/mongodb", () => mongoMocks);

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn().mockResolvedValue({ _id: "audit1" })
}));
const policyCacheMocks = vi.hoisted(() => ({
  bustTenantUxPolicyCacheForTenant: vi.fn()
}));

vi.mock("@/modules/audit/repository", () => ({
  createAuditEvent: auditMocks.createAuditEvent
}));
vi.mock("@/modules/platform/tenant-ux-policy-cache", () => ({
  bustTenantUxPolicyCacheForTenant: policyCacheMocks.bustTenantUxPolicyCacheForTenant
}));

import {
    GET as getTenantCatalog,
    PATCH as patchTenantCatalog
} from "@/app/api/admin/platform/route-catalog/[tenantId]/route";

describe("admin tenant route catalog overrides", () => {
  const findOne = vi.fn();
  const findOneAndUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireGlobalAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"]
    });
    findOne.mockResolvedValue({
      slug: "acme",
      name: "Acme",
      tenantPreferences: {
        app_user_route_visibility_overrides: {
          watchlist: false
        },
        app_user_default_landing_path_by_role: {
          advisor: "/xchat"
        }
      }
    });
    findOneAndUpdate.mockResolvedValue({
      slug: "acme",
      name: "Acme",
      tenantPreferences: {
        app_user_route_visibility_overrides: {
          watchlist: false,
          xoptions: true
        },
        app_user_default_landing_path_by_role: {
          advisor: "/xchat",
          viewer: "/portfolios"
        }
      }
    });
    mongoMocks.getDb.mockResolvedValue({
      collection: () => ({
        findOne,
        findOneAndUpdate
      })
    });
    policyCacheMocks.bustTenantUxPolicyCacheForTenant.mockResolvedValue({
      redisDeleted: 4,
      memoryDeleted: 2
    });
  });

  it("returns tenant overrides with catalog", async () => {
    const res = await getTenantCatalog(new Request("http://test"), {
      params: Promise.resolve({ tenantId: "507f1f77bcf86cd799439022" })
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        tenantId: string;
        overrides: Record<string, boolean>;
        defaultLandingPathByRole: Record<string, string>;
        catalog: { catalogKind: string };
      };
    };
    expect(body.data.tenantId).toBe("507f1f77bcf86cd799439022");
    expect(body.data.overrides.watchlist).toBe(false);
    expect(body.data.defaultLandingPathByRole.advisor).toBe("/xchat");
    expect(body.data.catalog.catalogKind).toBe("app_user_route_catalog");
  });

  it("patches tenant overrides and role landing paths", async () => {
    const res = await patchTenantCatalog(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: {
            watchlist: false,
            xoptions: true
          },
          defaultLandingPathByRole: {
            viewer: "/portfolios"
          }
        })
      }),
      { params: Promise.resolve({ tenantId: "507f1f77bcf86cd799439022" }) }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { overrides: Record<string, boolean>; defaultLandingPathByRole: Record<string, string> };
    };
    expect(body.data.overrides.watchlist).toBe(false);
    expect(body.data.overrides.xoptions).toBe(true);
    expect(body.data.defaultLandingPathByRole.viewer).toBe("/portfolios");
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(policyCacheMocks.bustTenantUxPolicyCacheForTenant).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439022",
      "route_catalog_patch"
    );
    expect(auditMocks.createAuditEvent).toHaveBeenCalledTimes(2);
    expect(auditMocks.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "tenant",
        entityId: "507f1f77bcf86cd799439022",
        action: "tenant_ux.route_catalog.patch",
        actor: expect.objectContaining({ userId: "507f1f77bcf86cd799439011" }),
        details: expect.objectContaining({
          overrides: expect.any(Object),
          defaultLandingPathByRole: expect.any(Object)
        })
      })
    );
  });

  it("rejects default landing path not visible for role and does not audit", async () => {
    const res = await patchTenantCatalog(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: { xchat: false },
          defaultLandingPathByRole: {
            viewer: "/xchat"
          }
        })
      }),
      { params: Promise.resolve({ tenantId: "507f1f77bcf86cd799439022" }) }
    );
    expect(res.status).toBe(400);
    expect(auditMocks.createAuditEvent).not.toHaveBeenCalled();
  });

  it("returns 403 passthrough when session is not global admin", async () => {
    authMocks.requireGlobalAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const res = await getTenantCatalog(new Request("http://test"), {
      params: Promise.resolve({ tenantId: "507f1f77bcf86cd799439022" })
    });
    expect(res.status).toBe(403);
  });
});
