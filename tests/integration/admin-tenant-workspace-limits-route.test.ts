import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireGlobalAdminSession: vi.fn()
}));

const bffMocks = vi.hoisted(() => ({
  proxyRequestToBackend: vi.fn<(request: Request) => Promise<Response | null>>()
}));

const identityRepoMocks = vi.hoisted(() => ({
  getTenantByHexId: vi.fn(),
  updateTenantWorkspaceLimits: vi.fn(),
  updateTenantBrandingPreferencesOneTime: vi.fn(),
  updateTenantXchatDebugEnabled: vi.fn()
}));

vi.mock("@/lib/api-auth", () => ({
  requireGlobalAdminSession: authMocks.requireGlobalAdminSession,
  requireAdminSession: authMocks.requireGlobalAdminSession
}));

vi.mock("@/lib/backend-bff", () => ({
  proxyRequestToBackend: bffMocks.proxyRequestToBackend
}));

vi.mock("@/modules/identity/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/identity/repository")>();
  return {
    ...actual,
    getTenantByHexId: identityRepoMocks.getTenantByHexId,
    updateTenantWorkspaceLimits: identityRepoMocks.updateTenantWorkspaceLimits,
    updateTenantBrandingPreferencesOneTime: identityRepoMocks.updateTenantBrandingPreferencesOneTime,
    updateTenantXchatDebugEnabled: identityRepoMocks.updateTenantXchatDebugEnabled
  };
});

import { GET, PATCH } from "@/app/api/admin/tenants/[tenantId]/workspace-limits/route";

const TENANT_HEX = "507f1f77bcf86cd799439022";

function baseTenant(
  overrides: {
    workspaceLimits?: Record<string, number> | null;
    tenantPreferences?: {
      xchat_brandname?: string;
      xstrategybuilder_brandname?: string;
      xchat_debug_enabled?: boolean;
    } | null;
  } = {}
) {
  const id = new ObjectId(TENANT_HEX);
  const now = new Date("2026-03-20T12:00:00.000Z");
  return {
    _id: id,
    slug: "atx-test",
    name: "ATX Test Tenant",
    isDefault: true,
    createdAt: now,
    updatedAt: now,
    workspaceLimits: overrides.workspaceLimits === undefined ? { userChatLimit: 8 } : overrides.workspaceLimits,
    tenantPreferences: overrides.tenantPreferences === undefined ? {} : overrides.tenantPreferences
  };
}

describe("GET/PATCH /api/admin/tenants/[tenantId]/workspace-limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffMocks.proxyRequestToBackend.mockResolvedValue(null);
    authMocks.requireGlobalAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: TENANT_HEX,
      email: "admin@atxfinance.ai",
      username: "xf-admin",
      roles: ["global_admin"],
      tenantRole: "tenant_admin",
      xUserId: "x1"
    });
    identityRepoMocks.updateTenantBrandingPreferencesOneTime.mockResolvedValue({
      tenant: baseTenant(),
      conflictKeys: []
    });
    identityRepoMocks.updateTenantXchatDebugEnabled.mockImplementation(async (_id: string, enabled: boolean) =>
      baseTenant({ tenantPreferences: { xchat_debug_enabled: enabled } })
    );
  });

  it("GET returns 403 when session is not global_admin", async () => {
    authMocks.requireGlobalAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const res = await GET(new Request("http://test"), {
      params: Promise.resolve({ tenantId: TENANT_HEX })
    });
    expect(res.status).toBe(403);
  });

  it("GET returns 404 when tenant is missing", async () => {
    identityRepoMocks.getTenantByHexId.mockResolvedValue(null);
    const res = await GET(new Request("http://test"), {
      params: Promise.resolve({ tenantId: TENANT_HEX })
    });
    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Tenant not found");
  });

  it("GET returns effective limits merged with raw partial", async () => {
    identityRepoMocks.getTenantByHexId.mockResolvedValue(baseTenant());
    const res = await GET(new Request("http://test"), {
      params: Promise.resolve({ tenantId: TENANT_HEX })
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: {
        tenantId: string;
        slug: string;
        workspaceLimits: Record<string, number>;
        workspaceLimitsRaw: Record<string, number> | null;
        tenantPreferences: { xchat_brandname?: string; xstrategybuilder_brandname?: string };
      };
    };
    expect(json.data.tenantId).toBe(TENANT_HEX);
    expect(json.data.slug).toBe("atx-test");
    expect(json.data.workspaceLimits.userChatLimit).toBe(8);
    expect(json.data.workspaceLimits.userXoptionsLimit).toBe(10);
    expect(json.data.workspaceLimitsRaw?.userChatLimit).toBe(8);
    expect(json.data.tenantPreferences).toEqual({});
  });

  it("PATCH updates limits and returns effective workspaceLimits", async () => {
    identityRepoMocks.getTenantByHexId.mockResolvedValue(baseTenant());
    const afterPatch = baseTenant({ workspaceLimits: { userChatLimit: 25, tenantPortfolioLimit: 2 } });
    identityRepoMocks.updateTenantWorkspaceLimits.mockResolvedValue(afterPatch);
    identityRepoMocks.updateTenantBrandingPreferencesOneTime.mockResolvedValue({
      tenant: afterPatch,
      conflictKeys: []
    });

    const req = new Request(`http://test/api/admin/tenants/${TENANT_HEX}/workspace-limits`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceLimits: { userChatLimit: 25, tenantPortfolioLimit: 2 }
      })
    });

    const res = await PATCH(req, { params: Promise.resolve({ tenantId: TENANT_HEX }) });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { workspaceLimits: { userChatLimit: number; tenantPortfolioLimit: number } };
    };
    expect(json.data.workspaceLimits.userChatLimit).toBe(25);
    expect(json.data.workspaceLimits.tenantPortfolioLimit).toBe(2);
    expect(identityRepoMocks.updateTenantWorkspaceLimits).toHaveBeenCalledWith(TENANT_HEX, {
      userChatLimit: 25,
      tenantPortfolioLimit: 2
    });
    expect(identityRepoMocks.updateTenantBrandingPreferencesOneTime).toHaveBeenCalledWith(TENANT_HEX, {});
  });

  it("PATCH sets tenantPreferences brand aliases once", async () => {
    const before = baseTenant({ tenantPreferences: {} });
    const after = baseTenant({
      tenantPreferences: {
        xchat_brandname: "Alpha Desk Chat",
        xstrategybuilder_brandname: "Alpha Strategy Lab"
      }
    });
    identityRepoMocks.getTenantByHexId.mockResolvedValue(before);
    identityRepoMocks.updateTenantWorkspaceLimits.mockResolvedValue(before);
    identityRepoMocks.updateTenantBrandingPreferencesOneTime.mockResolvedValue({
      tenant: after,
      conflictKeys: []
    });

    const req = new Request(`http://test/api/admin/tenants/${TENANT_HEX}/workspace-limits`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantPreferences: {
          xchat_brandname: "Alpha Desk Chat",
          xstrategybuilder_brandname: "Alpha Strategy Lab"
        }
      })
    });
    const res = await PATCH(req, { params: Promise.resolve({ tenantId: TENANT_HEX }) });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { tenantPreferences: { xchat_brandname?: string; xstrategybuilder_brandname?: string } };
    };
    expect(json.data.tenantPreferences.xchat_brandname).toBe("Alpha Desk Chat");
    expect(json.data.tenantPreferences.xstrategybuilder_brandname).toBe("Alpha Strategy Lab");
  });

  it("PATCH returns 409 when one-time tenantPreferences are overwritten", async () => {
    identityRepoMocks.getTenantByHexId.mockResolvedValue(
      baseTenant({ tenantPreferences: { xchat_brandname: "Fixed Chat" } })
    );
    identityRepoMocks.updateTenantWorkspaceLimits.mockResolvedValue(
      baseTenant({ tenantPreferences: { xchat_brandname: "Fixed Chat" } })
    );
    identityRepoMocks.updateTenantBrandingPreferencesOneTime.mockResolvedValue({
      tenant: baseTenant({ tenantPreferences: { xchat_brandname: "Fixed Chat" } }),
      conflictKeys: ["xchat_brandname"]
    });

    const req = new Request(`http://test/api/admin/tenants/${TENANT_HEX}/workspace-limits`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantPreferences: { xchat_brandname: "Try Rename" } })
    });
    const res = await PATCH(req, { params: Promise.resolve({ tenantId: TENANT_HEX }) });
    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("xchat_brandname");
  });

  it("PATCH sets tenantPreferences.xchat_debug_enabled", async () => {
    identityRepoMocks.getTenantByHexId.mockResolvedValue(baseTenant());
    identityRepoMocks.updateTenantWorkspaceLimits.mockResolvedValue(baseTenant());
    identityRepoMocks.updateTenantBrandingPreferencesOneTime.mockResolvedValue({
      tenant: baseTenant(),
      conflictKeys: []
    });

    const req = new Request(`http://test/api/admin/tenants/${TENANT_HEX}/workspace-limits`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceLimits: { userChatLimit: 8 },
        tenantPreferences: { xchat_debug_enabled: true }
      })
    });
    const res = await PATCH(req, { params: Promise.resolve({ tenantId: TENANT_HEX }) });
    expect(res.status).toBe(200);
    expect(identityRepoMocks.updateTenantXchatDebugEnabled).toHaveBeenCalledWith(TENANT_HEX, true);
    const json = (await res.json()) as {
      data: { tenantPreferences: Record<string, unknown> };
    };
    expect(json.data.tenantPreferences.xchat_debug_enabled).toBe(true);
  });

  it("PATCH returns 400 for invalid workspaceLimits values", async () => {
    identityRepoMocks.getTenantByHexId.mockResolvedValue(baseTenant());
    const req = new Request(`http://test/api/admin/tenants/${TENANT_HEX}/workspace-limits`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceLimits: { userChatLimit: 0 } })
    });
    const res = await PATCH(req, { params: Promise.resolve({ tenantId: TENANT_HEX }) });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("userChatLimit");
  });
});
