import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSessionUser: vi.fn()
}));
const tenantCacheMocks = vi.hoisted(() => ({
  getTenantByHexIdCached: vi.fn()
}));
const identityRepoMocks = vi.hoisted(() => ({
  getTenantShellBrandingForHex: vi.fn()
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/server-request-cache", () => tenantCacheMocks);
vi.mock("@/modules/identity/repository", () => identityRepoMocks);

import manifest from "@/app/manifest";

describe("app manifest route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getSessionUser.mockResolvedValue(null);
    tenantCacheMocks.getTenantByHexIdCached.mockResolvedValue(null);
    identityRepoMocks.getTenantShellBrandingForHex.mockResolvedValue(null);
  });

  it("returns default static manifest without tenant session", async () => {
    const data = await manifest();
    expect(data.name).toBe("aTx Advisor");
    expect(data.short_name).toBe("aTx");
    expect(data.theme_color).toBe("#050505");
    expect(data.icons?.length).toBeGreaterThan(0);
  });

  it("returns tenant-branded manifest for signed-in tenant", async () => {
    authMocks.getSessionUser.mockResolvedValue({
      tenantId: "507f1f77bcf86cd799439022"
    });
    tenantCacheMocks.getTenantByHexIdCached.mockResolvedValue({
      name: "Acme Advisory",
      tenantPreferences: {
        xf_tenant_logo_url: "https://cdn.example.com/acme-logo.png",
        xf_tenant_tagline: "Options income desk"
      }
    });
    identityRepoMocks.getTenantShellBrandingForHex.mockResolvedValue({
      displayName: "Acme Advisory",
      accentColor: "#22c55e"
    });
    const data = await manifest();
    expect(data.name).toBe("Acme Advisory");
    expect(data.short_name).toBe("Acme Adviso.");
    expect(data.theme_color).toBe("#22c55e");
    expect(data.description).toBe("Options income desk");
    expect(data.icons?.[0]?.src).toBe("https://cdn.example.com/acme-logo.png");
  });
});
