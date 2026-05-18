import { describe, expect, it } from "vitest";

import {
  parseTenantShellBrandingFromTenant,
  parseTenantXfUiThemeFromTenant
} from "@/modules/identity/tenant-shell-appearance";
import type { Tenant } from "@/modules/identity/types";

function baseTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    _id: { toHexString: () => "507f1f77bcf86cd799439011" } as Tenant["_id"],
    slug: "acme",
    name: "Acme Advisory",
    tenantPreferences: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  } as Tenant;
}

describe("tenant-shell-appearance parsers", () => {
  it("parses xf_ui_theme from tenant preferences", () => {
    const tenant = baseTenant({
      tenantPreferences: { xf_ui_theme: "light" }
    });
    expect(parseTenantXfUiThemeFromTenant(tenant)).toBe("light");
    expect(parseTenantXfUiThemeFromTenant(null)).toBeUndefined();
  });

  it("parses shell branding with accent fallback", () => {
    const tenant = baseTenant({
      tenantPreferences: {
        xf_accent_color: "#22c55e",
        xf_tenant_logo_url: "https://cdn.example.com/logo.png",
        xf_tenant_tagline: "Desk tagline"
      }
    });
    expect(parseTenantShellBrandingFromTenant(tenant)).toEqual({
      displayName: "Acme Advisory",
      accentColor: "#22c55e",
      logoUrl: "https://cdn.example.com/logo.png",
      tagline: "Desk tagline"
    });
  });
});
