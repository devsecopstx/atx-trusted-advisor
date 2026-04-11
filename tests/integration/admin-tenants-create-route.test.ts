import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const mongoMocks = vi.hoisted(() => ({
  getDb: vi.fn()
}));

const applyMocks = vi.hoisted(() => ({
  upsertTenantFromParsedSpecV1: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/lib/mongodb", () => mongoMocks);
vi.mock("@/modules/platform/tenant-spec-apply", () => applyMocks);

import { POST as postCreateTenant } from "@/app/api/admin/tenants/create/route";

describe("POST /api/admin/tenants/create", () => {
  beforeEach(() => {
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"]
    });
    mongoMocks.getDb.mockResolvedValue({});
    applyMocks.upsertTenantFromParsedSpecV1.mockResolvedValue({
      tenantId: "507f1f77bcf86cd7994390aa",
      slug: "acme-test",
      name: "Acme Test",
      provisionedInitialAdmin: true
    });
  });

  it("creates tenant for global_admin", async () => {
    const response = await postCreateTenant(
      new Request("http://test/api/admin/tenants/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "acme-test",
          name: "Acme Test",
          initialAdminEmail: "ops@acme.test",
          initialAdminPlatformRole: "operator"
        })
      })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { tenantId: string; slug: string; provisionedInitialAdmin: boolean };
    };
    expect(body.data.tenantId).toBe("507f1f77bcf86cd7994390aa");
    expect(body.data.slug).toBe("acme-test");
    expect(body.data.provisionedInitialAdmin).toBe(true);
    expect(applyMocks.upsertTenantFromParsedSpecV1).toHaveBeenCalledTimes(1);
    expect(applyMocks.upsertTenantFromParsedSpecV1).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        tenantPreferencesBranding: expect.objectContaining({
          xf_accent_color: "#8b5cf6"
        })
      })
    );
  });

  it("passes sanitized workspaceLimits into parsed spec", async () => {
    const response = await postCreateTenant(
      new Request("http://test/api/admin/tenants/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "quota-co",
          name: "Quota Co",
          workspaceLimits: { userChatLimit: 99, userXoptionsLimit: 12 }
        })
      })
    );
    expect(response.status).toBe(200);
    expect(applyMocks.upsertTenantFromParsedSpecV1).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        workspaceLimits: { userChatLimit: 99, userXoptionsLimit: 12 }
      })
    );
  });

  it("returns 400 for invalid workspaceLimits", async () => {
    const response = await postCreateTenant(
      new Request("http://test/api/admin/tenants/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "bad-wl",
          name: "Bad WL",
          workspaceLimits: { userChatLimit: 0 }
        })
      })
    );
    expect(response.status).toBe(400);
    expect(applyMocks.upsertTenantFromParsedSpecV1).not.toHaveBeenCalled();
  });

  it("merges branding fields into parsed spec", async () => {
    const response = await postCreateTenant(
      new Request("http://test/api/admin/tenants/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "branded-co",
          name: "Branded Co",
          xfAccentColor: "#abc",
          xfUiTheme: "dark",
          xfTenantTagline: "Family Office",
          xfTenantLogoUrl: "https://cdn.example/logo.png"
        })
      })
    );
    expect(response.status).toBe(200);
    expect(applyMocks.upsertTenantFromParsedSpecV1).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        tenantXfUiTheme: "dark",
        tenantPreferencesBranding: expect.objectContaining({
          xf_accent_color: "#aabbcc",
          xf_tenant_tagline: "Family Office",
          xf_tenant_logo_url: "https://cdn.example/logo.png"
        })
      })
    );
  });

  it("returns 400 for invalid slug", async () => {
    const response = await postCreateTenant(
      new Request("http://test/api/admin/tenants/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "Bad_Slug",
          name: "X"
        })
      })
    );
    expect(response.status).toBe(400);
    expect(applyMocks.upsertTenantFromParsedSpecV1).not.toHaveBeenCalled();
  });

  it("returns 403 when not global_admin", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const response = await postCreateTenant(
      new Request("http://test/api/admin/tenants/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "ok-slug", name: "Ok" })
      })
    );
    expect(response.status).toBe(403);
    expect(applyMocks.upsertTenantFromParsedSpecV1).not.toHaveBeenCalled();
  });
});
