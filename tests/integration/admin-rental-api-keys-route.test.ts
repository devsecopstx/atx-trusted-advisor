import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireGlobalAdminSession: vi.fn()
}));

const loadMocks = vi.hoisted(() => ({
  loadTenantForAdminTenantRoute: vi.fn()
}));

const keyMocks = vi.hoisted(() => ({
  listTenantRentalApiKeysForAdmin: vi.fn(),
  mintTenantRentalApiKey: vi.fn(),
  revokeTenantRentalApiKey: vi.fn(),
  rotateTenantRentalApiKey: vi.fn()
}));

vi.mock("@/lib/api-auth", () => ({
  requireGlobalAdminSession: authMocks.requireGlobalAdminSession
}));

vi.mock("@/app/api/admin/tenants/[tenantId]/admin-tenant-route-load", () => ({
  loadTenantForAdminTenantRoute: loadMocks.loadTenantForAdminTenantRoute
}));

vi.mock("@/modules/platform/tenant-rental-api-keys", () => keyMocks);

vi.mock("@/modules/audit/repository", () => ({
  createAuditEvent: vi.fn(async () => ({}))
}));

import { POST as POST_ROTATE } from "@/app/api/admin/tenants/[tenantId]/rental-api-keys/[keyId]/rotate/route";
import { DELETE } from "@/app/api/admin/tenants/[tenantId]/rental-api-keys/[keyId]/route";
import { GET, POST } from "@/app/api/admin/tenants/[tenantId]/rental-api-keys/route";

const TENANT_HEX = "507f1f77bcf86cd799439033";
const TENANT_OID = new ObjectId(TENANT_HEX);

describe("admin rental-api-keys routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireGlobalAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: TENANT_HEX,
      email: "admin@atxfinance.ai",
      username: "xf-admin",
      roles: ["global_admin"],
      tenantRole: "tenant_admin",
      xUserId: "x1"
    });
    loadMocks.loadTenantForAdminTenantRoute.mockResolvedValue({
      _id: TENANT_OID,
      slug: "rent-spec",
      name: "Rent Spec"
    });
  });

  it("GET lists keys", async () => {
    keyMocks.listTenantRentalApiKeysForAdmin.mockResolvedValue([
      {
        id: "0123456789abcdef",
        scopes: ["chat"],
        createdAt: new Date().toISOString(),
        status: "active"
      }
    ]);
    const res = await GET(new Request("http://test"), {
      params: Promise.resolve({ tenantId: TENANT_HEX })
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { keys: unknown[]; tenantId: string };
    expect(json.tenantId).toBe(TENANT_HEX);
    expect(json.keys).toHaveLength(1);
    expect(keyMocks.listTenantRentalApiKeysForAdmin).toHaveBeenCalledWith(TENANT_OID);
  });

  it("POST mint returns 201 with plaintextKey once", async () => {
    keyMocks.mintTenantRentalApiKey.mockResolvedValue({
      ok: true,
      plaintextKey: "atxr_deadbeefcafecafe_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      listed: {
        id: "deadbeefcafecafe",
        scopes: ["chat", "strategy", "analyze"],
        createdAt: new Date().toISOString(),
        status: "active"
      }
    });
    const res = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "partner" })
      }),
      { params: Promise.resolve({ tenantId: TENANT_HEX }) }
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as { plaintextKey: string; key: { id: string } };
    expect(json.plaintextKey.startsWith("atxr_")).toBe(true);
    expect(json.key.id).toBe("deadbeefcafecafe");
  });

  it("DELETE revoke returns 200", async () => {
    keyMocks.revokeTenantRentalApiKey.mockResolvedValue({ ok: true });
    const res = await DELETE(new Request("http://test"), {
      params: Promise.resolve({ tenantId: TENANT_HEX, keyId: "deadbeefcafecafe" })
    });
    expect(res.status).toBe(200);
    expect(keyMocks.revokeTenantRentalApiKey).toHaveBeenCalledWith({
      tenantId: TENANT_OID,
      keyId: "deadbeefcafecafe"
    });
  });

  it("POST rotate returns plaintextKey", async () => {
    keyMocks.rotateTenantRentalApiKey.mockResolvedValue({
      ok: true,
      plaintextKey: `atxr_0123456789abcdef_${"a".repeat(64)}`,
      listed: {
        id: "0123456789abcdef",
        scopes: ["chat"],
        createdAt: new Date().toISOString(),
        status: "active"
      },
      revokedKeyId: "deadbeefcafecafe"
    });
    const res = await POST_ROTATE(new Request("http://test", { method: "POST" }), {
      params: Promise.resolve({ tenantId: TENANT_HEX, keyId: "deadbeefcafecafe" })
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { revokedKeyId: string };
    expect(json.revokedKeyId).toBe("deadbeefcafecafe");
  });

  it("GET returns 404 when tenant missing", async () => {
    loadMocks.loadTenantForAdminTenantRoute.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://test"), {
      params: Promise.resolve({ tenantId: TENANT_HEX })
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when session not global_admin", async () => {
    authMocks.requireGlobalAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const res = await GET(new Request("http://test"), {
      params: Promise.resolve({ tenantId: TENANT_HEX })
    });
    expect(res.status).toBe(403);
  });
});
