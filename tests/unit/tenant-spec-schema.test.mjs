import { describe, expect, it } from "vitest";

import {
    assertValidTenantSlug,
    normalizeProvisionEmail,
    parseInitialTenantAdmin,
    parseOptionalTenantXfUiTheme,
    parseOptionalWatchlistSeedSymbols,
    parseTenantBootstrapPolicyFromUnknown,
    parseTenantSpecV1Document,
    sanitizeTenantPreferencesBrandingPartial,
    sanitizeWorkspaceLimitsPartial
} from "../../scripts/lib/tenant-spec-schema.mjs";

describe("tenant-spec-schema", () => {
  it("accepts valid slugs", () => {
    expect(assertValidTenantSlug("acme")).toBe("acme");
    expect(assertValidTenantSlug("acme-advisors")).toBe("acme-advisors");
  });

  it("rejects invalid slugs", () => {
    expect(() => assertValidTenantSlug("")).toThrow();
    expect(() => assertValidTenantSlug("Acme")).toThrow();
    expect(() => assertValidTenantSlug("atxfinance-core")).toThrow();
  });

  it("sanitizes workspace limit numbers", () => {
    expect(
      sanitizeWorkspaceLimitsPartial({
        userChatLimit: 25,
        changePersonaEnabled: false
      })
    ).toEqual({ userChatLimit: 25, changePersonaEnabled: false });
  });

  it("normalizes provision email", () => {
    expect(normalizeProvisionEmail("  Admin@Acme.IO ")).toBe("admin@acme.io");
    expect(() => normalizeProvisionEmail("not-an-email")).toThrow();
  });

  it("parses initialTenantAdmin defaults", () => {
    expect(
      parseInitialTenantAdmin({
        email: "ops@acme.io"
      })
    ).toEqual({
      email: "ops@acme.io",
      platformRole: "operator",
      setAsDefaultSessionTenant: true
    });
  });

  it("parses initialTenantAdmin with xUserId and platformRole", () => {
    expect(
      parseInitialTenantAdmin({
        email: "ops@acme.io",
        xUserId: "12345",
        platformRole: "advisor",
        setAsDefaultSessionTenant: false
      })
    ).toEqual({
      email: "ops@acme.io",
      xUserId: "12345",
      platformRole: "advisor",
      setAsDefaultSessionTenant: false
    });
  });

  it("strips leading @ from xUserId / handle", () => {
    expect(
      parseInitialTenantAdmin({
        email: "ops@acme.io",
        xUserId: "@Somegoodnewsatx"
      })?.xUserId
    ).toBe("Somegoodnewsatx");
  });

  it("sanitizes tenant branding preferences", () => {
    expect(
      sanitizeTenantPreferencesBrandingPartial({
        xchat_brandname: "  Acme Chat  ",
        xstrategybuilder_brandname: "x".repeat(100)
      })
    ).toEqual({
      xchat_brandname: "Acme Chat",
      xstrategybuilder_brandname: "x".repeat(80)
    });
  });

  it("parseTenantSpecV1Document reads tenant.initialTenantAdmin", () => {
    const r = parseTenantSpecV1Document({
      version: 1,
      tenant: {
        slug: "acme-advisors",
        name: "Acme Advisors",
        isDefault: false,
        initialTenantAdmin: { email: "admin@acme.io", platformRole: "viewer" }
      }
    });
    expect(r.slug).toBe("acme-advisors");
    expect(r.initialTenantAdmin?.email).toBe("admin@acme.io");
    expect(r.initialTenantAdmin?.platformRole).toBe("viewer");
  });

  it("parseOptionalTenantXfUiTheme accepts light, dark, system", () => {
    expect(parseOptionalTenantXfUiTheme({ xf_ui_theme: "LIGHT" })).toBe("light");
    expect(parseOptionalTenantXfUiTheme({ xf_ui_theme: "dark" })).toBe("dark");
    expect(parseOptionalTenantXfUiTheme({ xf_ui_theme: "system" })).toBe("system");
    expect(parseOptionalTenantXfUiTheme({})).toBeUndefined();
    expect(() => parseOptionalTenantXfUiTheme({ xf_ui_theme: "sepia" })).toThrow();
  });

  it("parseTenantSpecV1Document reads tenantPreferences.xf_ui_theme", () => {
    const r = parseTenantSpecV1Document({
      version: 1,
      tenant: {
        slug: "t1",
        name: "T1",
        tenantPreferences: { xf_ui_theme: "light" }
      }
    });
    expect(r.tenantXfUiTheme).toBe("light");
  });

  it("parseTenantSpecV1Document merges xf_brand_palette and xf_hero_icon_url into branding", () => {
    const r = parseTenantSpecV1Document({
      version: 1,
      tenant: {
        slug: "t-brand",
        name: "T Brand",
        tenantPreferences: {
          xf_brand_palette: "violet",
          xf_hero_icon_url: "https://cdn.example.com/logo.png"
        }
      }
    });
    expect(r.tenantPreferencesBranding?.xf_brand_palette).toBe("violet");
    expect(r.tenantPreferencesBranding?.xf_hero_icon_url).toBe("https://cdn.example.com/logo.png");
  });

  it("parseTenantSpecV1Document reads bootstrapPolicy + bootstrapOnApprove + watchlist_seed_symbols", () => {
    const r = parseTenantSpecV1Document({
      version: 1,
      tenant: {
        slug: "boot",
        name: "Boot",
        bootstrapOnApprove: true,
        bootstrapPolicy: {
          defaultPortfolio: { viewer: false, operator: true, advisor: true },
          defaultWatchlist: { viewer: false, operator: true, advisor: true },
          overrides: []
        },
        tenantPreferences: {
          watchlist_seed_symbols: ["spy", "qqq"]
        }
      }
    });
    expect(r.slug).toBe("boot");
    expect(r.bootstrapOnApprove).toBe(true);
    expect(r.bootstrapPolicy?.defaultPortfolio?.viewer).toBe(false);
    expect(r.watchlistSeedSymbols).toEqual(["SPY", "QQQ"]);
  });

  it("parseTenantSpecV1Document rejects invalid bootstrapOnApprove", () => {
    expect(() =>
      parseTenantSpecV1Document({
        version: 1,
        tenant: { slug: "x", name: "X", bootstrapOnApprove: "yes" }
      })
    ).toThrow(/bootstrapOnApprove/);
  });

  it("parseOptionalWatchlistSeedSymbols rejects non-array", () => {
    expect(() => parseOptionalWatchlistSeedSymbols({ watchlist_seed_symbols: "SPY" })).toThrow(
      /watchlist_seed_symbols/
    );
  });

  it("parseTenantBootstrapPolicyFromUnknown returns defaults for null", () => {
    const d = parseTenantBootstrapPolicyFromUnknown(null);
    expect(d.defaultPortfolio.viewer).toBe(false);
    expect(d.defaultPortfolio.operator).toBe(true);
  });
});
