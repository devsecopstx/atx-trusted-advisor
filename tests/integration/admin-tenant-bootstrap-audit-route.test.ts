import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireGlobalAdminSession: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  listAuditEvents: vi.fn()
}));

const identityRepoMocks = vi.hoisted(() => ({
  getTenantByHexId: vi.fn(),
  resolveTenantIdHexForGlobalAdminConsole: vi.fn()
}));

const bootstrapMocks = vi.hoisted(() => ({
  ensureTenantBootstrapForUser: vi.fn()
}));

const mongoMocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  getDb: vi.fn()
}));

vi.mock("@/lib/api-auth", () => ({
  requireGlobalAdminSession: authMocks.requireGlobalAdminSession
}));

vi.mock("@/modules/audit/repository", () => ({
  listAuditEvents: auditMocks.listAuditEvents
}));

vi.mock("@/modules/identity/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/identity/repository")>();
  return {
    ...actual,
    getTenantByHexId: identityRepoMocks.getTenantByHexId,
    resolveTenantIdHexForGlobalAdminConsole: identityRepoMocks.resolveTenantIdHexForGlobalAdminConsole
  };
});

vi.mock("@/modules/core-admin/tenant-user-bootstrap", () => ({
  ensureTenantBootstrapForUser: bootstrapMocks.ensureTenantBootstrapForUser
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mongoMocks.getDb
}));

import { GET } from "@/app/api/admin/tenants/[tenantId]/bootstrap-audit/route";
import { POST } from "@/app/api/admin/tenants/[tenantId]/bootstrap-replay/route";

const TENANT_HEX = "507f1f77bcf86cd799439022";

function baseTenant() {
  const id = new ObjectId(TENANT_HEX);
  return {
    _id: id,
    slug: "acme",
    name: "Acme",
    isDefault: false
  };
}

describe("/api/admin/tenants/[tenantId]/bootstrap-audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    identityRepoMocks.resolveTenantIdHexForGlobalAdminConsole.mockResolvedValue(null);
    authMocks.requireGlobalAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: TENANT_HEX,
      email: "admin@atxfinance.ai",
      username: "xf-admin",
      roles: ["global_admin"],
      tenantRole: "tenant_admin",
      xUserId: "x1"
    });
    identityRepoMocks.getTenantByHexId.mockResolvedValue(baseTenant());
    auditMocks.listAuditEvents.mockResolvedValue([
      {
        _id: new ObjectId(),
        entityType: "tenant" as const,
        entityId: TENANT_HEX,
        action: "tenant_provision_bootstrap",
        actor: { userId: "64a1b2c3d4e5f678901234aa" },
        details: { trigger: "oauth_login", platformRole: "operator", success: true, portfolioId: "abc" },
        createdAt: new Date("2026-05-01T12:00:00.000Z")
      }
    ]);
  });

  it("GET returns 403 when not global_admin", async () => {
    authMocks.requireGlobalAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const res = await GET(new Request("http://test"), {
      params: Promise.resolve({ tenantId: TENANT_HEX })
    });
    expect(res.status).toBe(403);
  });

  it("GET returns audit rows", async () => {
    const res = await GET(new Request("http://test"), {
      params: Promise.resolve({ tenantId: TENANT_HEX })
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { events: { trigger?: string }[] };
    };
    expect(json.data.events).toHaveLength(1);
    expect(json.data.events[0]?.details.trigger).toBe("oauth_login");
  });
});

describe("/api/admin/tenants/[tenantId]/bootstrap-replay", () => {
  const USER_HEX = "64a1b2c3d4e5f678901234aa";

  beforeEach(() => {
    vi.clearAllMocks();
    identityRepoMocks.resolveTenantIdHexForGlobalAdminConsole.mockResolvedValue(null);
    authMocks.requireGlobalAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: TENANT_HEX,
      email: "admin@atxfinance.ai",
      username: "xf-admin",
      roles: ["global_admin"],
      tenantRole: "tenant_admin",
      xUserId: "x1"
    });
    identityRepoMocks.getTenantByHexId.mockResolvedValue(baseTenant());
    mongoMocks.getDb.mockResolvedValue({
      collection: () => ({
        findOne: mongoMocks.findOne
      })
    });
    mongoMocks.findOne.mockResolvedValue({ _id: new ObjectId(), userId: new ObjectId(USER_HEX) });
  });

  it("POST returns 400 when user not in tenant", async () => {
    mongoMocks.findOne.mockResolvedValueOnce(null);
    const res = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: USER_HEX })
      }),
      { params: Promise.resolve({ tenantId: TENANT_HEX }) }
    );
    expect(res.status).toBe(400);
  });

  it("POST runs ensureTenantBootstrapForUser when membership exists", async () => {
    bootstrapMocks.ensureTenantBootstrapForUser.mockResolvedValue({
      didProvision: true,
      result: {
        portfolio: { _id: new ObjectId("64a1b2c3d4e5f678901234bb") },
        account: { _id: new ObjectId() },
        watchlist: { _id: new ObjectId() }
      },
      platformRole: "operator"
    });
    const res = await POST(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: USER_HEX })
      }),
      { params: Promise.resolve({ tenantId: TENANT_HEX }) }
    );
    expect(res.status).toBe(200);
    expect(bootstrapMocks.ensureTenantBootstrapForUser).toHaveBeenCalledWith({
      userId: USER_HEX,
      tenantId: TENANT_HEX,
      trigger: "admin_replay"
    });
  });
});
