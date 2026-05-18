import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSessionUser: vi.fn()
}));
const shellCacheMocks = vi.hoisted(() => ({
  getTenantShellBrandingForHexCached: vi.fn()
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/identity-shell-cache", () => shellCacheMocks);

import manifest from "@/app/manifest";

describe("app manifest route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getSessionUser.mockResolvedValue(null);
    shellCacheMocks.getTenantShellBrandingForHexCached.mockResolvedValue(null);
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
    shellCacheMocks.getTenantShellBrandingForHexCached.mockResolvedValue({
      displayName: "Acme Advisory",
      accentColor: "#22c55e",
      logoUrl: "https://cdn.example.com/acme-logo.png",
      tagline: "Options income desk"
    });
    const data = await manifest();
    expect(data.name).toBe("Acme Advisory");
    expect(data.short_name).toBe("Acme Adviso.");
    expect(data.theme_color).toBe("#22c55e");
    expect(data.description).toBe("Options income desk");
    expect(data.icons?.[0]?.src).toBe("https://cdn.example.com/acme-logo.png");
  });
});
