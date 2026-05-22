import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireGlobalAdminSession: vi.fn()
}));

const identityRepoMocks = vi.hoisted(() => ({
  getTenantByHexId: vi.fn(),
  resolveTenantIdHexForGlobalAdminConsole: vi.fn(),
  updateTenantWorkspaceLimits: vi.fn(),
  updateTenantBrandingPreferencesOneTime: vi.fn(),
  updateTenantXchatDebugEnabled: vi.fn(),
  updateTenantFeatureFlags: vi.fn(),
  tenantHasAdminMembership: vi.fn()
}));

const auditMocks = vi.hoisted(() => ({
  createAuditEvent: vi.fn()
}));

vi.mock("@/lib/api-auth", () => ({
  requireGlobalAdminSession: authMocks.requireGlobalAdminSession,
  requireAdminSession: authMocks.requireGlobalAdminSession
}));

vi.mock("@/modules/audit/repository", () => ({
  createAuditEvent: auditMocks.createAuditEvent
}));

vi.mock("@/modules/identity/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/identity/repository")>();
  return {
    ...actual,
    getTenantByHexId: identityRepoMocks.getTenantByHexId,
    resolveTenantIdHexForGlobalAdminConsole: identityRepoMocks.resolveTenantIdHexForGlobalAdminConsole,
    updateTenantWorkspaceLimits: identityRepoMocks.updateTenantWorkspaceLimits,
    updateTenantBrandingPreferencesOneTime: identityRepoMocks.updateTenantBrandingPreferencesOneTime,
    updateTenantXchatDebugEnabled: identityRepoMocks.updateTenantXchatDebugEnabled,
    updateTenantFeatureFlags: identityRepoMocks.updateTenantFeatureFlags,
    tenantHasAdminMembership: identityRepoMocks.tenantHasAdminMembership
  };
});

import { PATCH } from "@/app/api/admin/tenants/[tenantId]/workspace-limits/route";

const TENANT_HEX = "507f1f77bcf86cd799439022";

function baseTenant(
  overrides: {
    workspaceLimits?: Record<string, unknown> | null;
    tenantPreferences?: Record<string, unknown> | null;
  } = {}
) {
  const id = new ObjectId(TENANT_HEX);
  const now = new Date("2026-05-10T12:00:00.000Z");
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

describe("PATCH /api/admin/tenants/[tenantId]/workspace-limits — featureFlags", () => {
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
    identityRepoMocks.updateTenantBrandingPreferencesOneTime.mockResolvedValue({
      tenant: baseTenant(),
      conflictKeys: []
    });
    identityRepoMocks.updateTenantWorkspaceLimits.mockResolvedValue(baseTenant());
    auditMocks.createAuditEvent.mockResolvedValue({});
    identityRepoMocks.tenantHasAdminMembership.mockResolvedValue(true);
  });

  it("saves valid feature flags and writes audit event", async () => {
    const flagsPayload = { "voice-input": true, "max-retries": 3 };
    const updatedTenant = baseTenant({
      tenantPreferences: { featureFlags: flagsPayload }
    });
    identityRepoMocks.getTenantByHexId.mockResolvedValue(baseTenant());
    identityRepoMocks.updateTenantFeatureFlags.mockResolvedValue(updatedTenant);

    const body = JSON.stringify({ featureFlags: flagsPayload });
    const request = new Request("http://localhost:3000/api/admin/tenants/" + TENANT_HEX + "/workspace-limits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body
    });

    const response = await PATCH(request, { params: Promise.resolve({ tenantId: TENANT_HEX }) });

    expect(response.status).toBe(200);
    expect(identityRepoMocks.updateTenantFeatureFlags).toHaveBeenCalledWith(TENANT_HEX, flagsPayload);

    await vi.waitFor(() => {
      expect(auditMocks.createAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "tenant",
          entityId: TENANT_HEX,
          action: "feature_flags_update",
          details: expect.objectContaining({
            before: {},
            after: flagsPayload
          })
        })
      );
    });
  });

  it("rejects invalid feature flag keys", async () => {
    identityRepoMocks.getTenantByHexId.mockResolvedValue(baseTenant());
    identityRepoMocks.updateTenantWorkspaceLimits.mockResolvedValue(baseTenant());

    const body = JSON.stringify({ featureFlags: { "INVALID_KEY": true } });
    const request = new Request("http://localhost:3000/api/admin/tenants/" + TENANT_HEX + "/workspace-limits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body
    });

    const response = await PATCH(request, { params: Promise.resolve({ tenantId: TENANT_HEX }) });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("INVALID_KEY");
  });

  it("rejects invalid feature flag value types", async () => {
    identityRepoMocks.getTenantByHexId.mockResolvedValue(baseTenant());
    identityRepoMocks.updateTenantWorkspaceLimits.mockResolvedValue(baseTenant());

    const body = JSON.stringify({ featureFlags: { "nested-obj": { a: 1 } } });
    const request = new Request("http://localhost:3000/api/admin/tenants/" + TENANT_HEX + "/workspace-limits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body
    });

    const response = await PATCH(request, { params: Promise.resolve({ tenantId: TENANT_HEX }) });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("must be boolean, number, or string");
  });

  it("does not call updateTenantFeatureFlags when featureFlags not in body", async () => {
    identityRepoMocks.getTenantByHexId.mockResolvedValue(baseTenant());

    const body = JSON.stringify({ workspaceLimits: { userChatLimit: 10 } });
    const request = new Request("http://localhost:3000/api/admin/tenants/" + TENANT_HEX + "/workspace-limits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body
    });

    const response = await PATCH(request, { params: Promise.resolve({ tenantId: TENANT_HEX }) });

    expect(response.status).toBe(200);
    expect(identityRepoMocks.updateTenantFeatureFlags).not.toHaveBeenCalled();
  });
});
