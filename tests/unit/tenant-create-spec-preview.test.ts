import { describe, expect, it } from "vitest";

import { buildTenantSpecV1YamlPreview } from "@/lib/tenant-create-spec-preview";

describe("buildTenantSpecV1YamlPreview", () => {
  it("includes slug, tenantPreferences, and optional blocks", () => {
    const y = buildTenantSpecV1YamlPreview({
      slug: "demo",
      name: "Demo Org",
      accentHex: "#39ff14",
      xfUiTheme: "dark",
      xfBrandPalette: "",
      tagline: "Family office",
      bootstrapDefaultPortfolioWatchlist: true,
      initialAdminEmail: "ops@demo.com",
      initialAdminXUserId: "",
      initialAdminPlatformRole: "operator",
      setAsDefaultSessionTenant: true,
      workspaceLimitsJson: '{"userChatLimit": 50}',
      allowWorkspaceLimitsOverride: true,
      routeOverridesJson: '{"watchlist": false}',
      defaultLandingJson: '{"viewer": "/xchat"}'
    });
    expect(y).toContain("version: 1");
    expect(y).toContain("slug: demo");
    expect(y).toContain("xf_accent_color:");
    expect(y).toContain("bootstrap_default_portfolio_watchlist: true");
    expect(y).toContain("userChatLimit: 50");
    expect(y).toContain("watchlist: false");
    expect(y).toContain('/xchat');
  });
});
