import { stringify } from "yaml";

import { DEFAULT_TENANT_ACCENT_HEX, normalizeXfAccentColor } from "@/lib/tenant-accent-color";
import type { XfBrandPaletteId } from "@/lib/tenant-branding-palette";

export type TenantCreateYamlPreviewInput = {
  slug: string;
  name: string;
  accentHex: string;
  xfUiTheme: "" | "light" | "dark" | "system";
  xfBrandPalette: "" | XfBrandPaletteId;
  tagline: string;
  bootstrapDefaultPortfolioWatchlist: boolean;
  initialAdminEmail: string;
  initialAdminXUserId: string;
  initialAdminPlatformRole: "advisor" | "operator" | "viewer";
  setAsDefaultSessionTenant: boolean;
  workspaceLimitsJson: string;
  allowWorkspaceLimitsOverride: boolean;
  routeOverridesJson: string;
  defaultLandingJson: string;
};

/** Read-only YAML shaped like `tenant-specs/*.yaml` v1 — mirrors create-tenant POST body (not executed). */
export function buildTenantSpecV1YamlPreview(input: TenantCreateYamlPreviewInput): string {
  let accent = DEFAULT_TENANT_ACCENT_HEX;
  try {
    accent = normalizeXfAccentColor(input.accentHex.trim() || DEFAULT_TENANT_ACCENT_HEX);
  } catch {
    accent = DEFAULT_TENANT_ACCENT_HEX;
  }

  const tenant: Record<string, unknown> = {
    slug: input.slug.trim(),
    name: input.name.trim(),
    isDefault: false
  };

  const email = input.initialAdminEmail.trim();
  if (email) {
    const block: Record<string, unknown> = { email };
    const xid = input.initialAdminXUserId.trim();
    if (xid) {
      block.xUserId = xid;
    }
    block.platformRole = input.initialAdminPlatformRole;
    block.setAsDefaultSessionTenant = input.setAsDefaultSessionTenant;
    tenant.initialTenantAdmin = block;
  }

  const tp: Record<string, unknown> = {
    xf_accent_color: accent
  };
  if (input.xfUiTheme) {
    tp.xf_ui_theme = input.xfUiTheme;
  }
  if (input.xfBrandPalette) {
    tp.xf_brand_palette = input.xfBrandPalette;
  }
  const tag = input.tagline.trim();
  if (tag) {
    tp.xf_tenant_tagline = tag.slice(0, 60);
  }
  tp.bootstrap_default_portfolio_watchlist = input.bootstrapDefaultPortfolioWatchlist;
  tenant.tenantPreferences = tp;

  const wlTrim = input.workspaceLimitsJson.trim();
  if (wlTrim && input.allowWorkspaceLimitsOverride) {
    try {
      const parsed = JSON.parse(wlTrim) as unknown;
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        tenant.workspaceLimits = parsed;
      }
    } catch {
      /* omit invalid JSON from preview */
    }
  }

  let routeOverrides: Record<string, boolean> | undefined;
  const routeTrim = input.routeOverridesJson.trim();
  if (routeTrim) {
    try {
      const parsed = JSON.parse(routeTrim) as unknown;
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        routeOverrides = parsed as Record<string, boolean>;
      }
    } catch {
      /* omit */
    }
  }
  if (routeOverrides && Object.keys(routeOverrides).length > 0) {
    tenant.appUserRouteVisibilityOverrides = routeOverrides;
  }

  let defaultLanding: Record<string, string> | undefined;
  const landTrim = input.defaultLandingJson.trim();
  if (landTrim) {
    try {
      const parsed = JSON.parse(landTrim) as unknown;
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        defaultLanding = parsed as Record<string, string>;
      }
    } catch {
      /* omit */
    }
  }
  if (defaultLanding && Object.keys(defaultLanding).length > 0) {
    tenant.defaultLandingPathByRole = defaultLanding;
  }

  const doc = { version: 1, tenant };
  return stringify(doc, { lineWidth: 100 });
}
