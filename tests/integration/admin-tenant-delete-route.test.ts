import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireGlobalAdminSession: vi.fn()
}));

const cacheMocks = vi.hoisted(() => ({
  getTenantByHexIdCached: vi.fn()
}));

const identityMocks = vi.hoisted(() => ({
  deleteTenantIfNoMemberships: vi.fn(),
  resolveTenantIdHexForGlobalAdminConsole: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/lib/server-request-cache", () => cacheMocks);
vi.mock("@/modules/identity/repository", () => identityMocks);

import { DELETE as deleteTenant } from "@/app/api/admin/tenants/[tenantId]/route";

describe("DELETE /api/admin/tenants/{tenantId}", () => {
  const tenantHex = "507f1f77bcf86cd7994390aa";

  beforeEach(() => {
    authMocks.requireGlobalAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"]
    });
    cacheMocks.getTenantByHexIdCached.mockResolvedValue({
      _id: { toHexString: () => tenantHex },
      slug: "acme",
      name: "Acme"
    });
    identityMocks.resolveTenantIdHexForGlobalAdminConsole.mockResolvedValue(null);
    identityMocks.deleteTenantIfNoMemberships.mockResolvedValue({ ok: true });
  });

  it("returns 200 when delete succeeds", async () => {
    const response = await deleteTenant(
      new Request(`http://test/api/admin/tenants/${tenantHex}`),
      { params: Promise.resolve({ tenantId: tenantHex }) }
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { deleted: boolean; tenantId: string } };
    expect(body.data.deleted).toBe(true);
    expect(body.data.tenantId).toBe(tenantHex);
    expect(identityMocks.deleteTenantIfNoMemberships).toHaveBeenCalledWith(tenantHex);
  });

  it("returns 200 with xaiTeamAttachmentsCollection when repository reports it", async () => {
    identityMocks.deleteTenantIfNoMemberships.mockResolvedValueOnce({
      ok: true,
      xaiTeamAttachmentsCollection: { outcome: "deleted", collectionId: "xai_col_1" }
    });
    const response = await deleteTenant(
      new Request(`http://test/api/admin/tenants/${tenantHex}`),
      { params: Promise.resolve({ tenantId: tenantHex }) }
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { xaiTeamAttachmentsCollection?: { outcome: string; collectionId?: string } };
    };
    expect(body.data.xaiTeamAttachmentsCollection?.outcome).toBe("deleted");
    expect(body.data.xaiTeamAttachmentsCollection?.collectionId).toBe("xai_col_1");
  });

  it("returns 502 when xAI collection delete fails", async () => {
    identityMocks.deleteTenantIfNoMemberships.mockResolvedValueOnce({
      ok: false,
      code: "XAI_COLLECTION_DELETE_FAILED",
      xaiError: "upstream timeout"
    });
    const response = await deleteTenant(
      new Request(`http://test/api/admin/tenants/${tenantHex}`),
      { params: Promise.resolve({ tenantId: tenantHex }) }
    );
    expect(response.status).toBe(502);
    const body = (await response.json()) as { code?: string; details?: string };
    expect(body.code).toBe("xai_collection_delete_failed");
    expect(body.details).toBe("upstream timeout");
  });

  it("returns 409 when tenant still has memberships", async () => {
    identityMocks.deleteTenantIfNoMemberships.mockResolvedValueOnce({ ok: false, code: "HAS_MEMBERS" });
    const response = await deleteTenant(
      new Request(`http://test/api/admin/tenants/${tenantHex}`),
      { params: Promise.resolve({ tenantId: tenantHex }) }
    );
    expect(response.status).toBe(409);
  });

  it("returns 403 when not global_admin", async () => {
    authMocks.requireGlobalAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const response = await deleteTenant(
      new Request(`http://test/api/admin/tenants/${tenantHex}`),
      { params: Promise.resolve({ tenantId: tenantHex }) }
    );
    expect(response.status).toBe(403);
    expect(identityMocks.deleteTenantIfNoMemberships).not.toHaveBeenCalled();
  });
});
