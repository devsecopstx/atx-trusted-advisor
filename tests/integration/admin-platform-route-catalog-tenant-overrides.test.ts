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
        }
      }
    });
    mongoMocks.getDb.mockResolvedValue({
      collection: () => ({
        findOne,
        findOneAndUpdate
      })
    });
  });

  it("returns tenant overrides with catalog", async () => {
    const res = await getTenantCatalog(new Request("http://test"), {
      params: Promise.resolve({ tenantId: "507f1f77bcf86cd799439022" })
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { tenantId: string; overrides: Record<string, boolean>; catalog: { catalogKind: string } };
    };
    expect(body.data.tenantId).toBe("507f1f77bcf86cd799439022");
    expect(body.data.overrides.watchlist).toBe(false);
    expect(body.data.catalog.catalogKind).toBe("app_user_route_catalog");
  });

  it("patches tenant overrides and returns effective map", async () => {
    const res = await patchTenantCatalog(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: {
            watchlist: false,
            xoptions: true
          }
        })
      }),
      { params: Promise.resolve({ tenantId: "507f1f77bcf86cd799439022" }) }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { overrides: Record<string, boolean> } };
    expect(body.data.overrides.watchlist).toBe(false);
    expect(body.data.overrides.xoptions).toBe(true);
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
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
