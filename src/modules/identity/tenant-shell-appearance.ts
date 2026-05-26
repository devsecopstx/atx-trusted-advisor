import { DEFAULT_TENANT_ACCENT_HEX, normalizeXfAccentColor } from "@/lib/tenant-accent-color";
import {
  parseXfUiThemePreferenceFromUnknown,
  type XfUiThemePreference
} from "@/lib/xf-ui-theme";
import type { TenantShellBranding } from "@/modules/identity/tenant-shell-branding";
import type { Tenant } from "@/modules/identity/types";

export type TenantShellAppearance = {
  xfUiTheme: XfUiThemePreference | undefined;
  shellBranding: TenantShellBranding | null;
};

export function parseTenantXfUiThemeFromTenant(
  tenant: Tenant | null | undefined
): XfUiThemePreference | undefined {
  const raw = tenant?.tenantPreferences?.xf_ui_theme;
  return parseXfUiThemePreferenceFromUnknown(raw);
}

/** Pure parse from a loaded `core_tenants` row (accent falls back to default when unset). */
export function parseTenantShellBrandingFromTenant(
  tenant: Tenant | null | undefined
): TenantShellBranding | null {
  if (!tenant) {
    return null;
  }
  const p = tenant.tenantPreferences;
  let accentColor = DEFAULT_TENANT_ACCENT_HEX;
  try {
    const raw =
      p && typeof p === "object" && p !== null
        ? (p as Record<string, unknown>).xf_accent_color
        : undefined;
    if (raw !== undefined && raw !== null && String(raw).trim()) {
      accentColor = normalizeXfAccentColor(raw);
    }
  } catch {
    accentColor = DEFAULT_TENANT_ACCENT_HEX;
  }
  const logoUrl =
    p && typeof p === "object" && p !== null
      ? String((p as Record<string, unknown>).xf_tenant_logo_url ?? "").trim() || undefined
      : undefined;
  const tagline =
    p && typeof p === "object" && p !== null
      ? String((p as Record<string, unknown>).xf_tenant_tagline ?? "").trim().slice(0, 60) || undefined
      : undefined;
  const xchatBrandName =
    p && typeof p === "object" && p !== null
      ? String((p as Record<string, unknown>).xchat_brandname ?? "").trim().slice(0, 80) || undefined
      : undefined;
  const displayName = String(tenant.name ?? "").trim() || tenant.slug;
  return { displayName, accentColor, logoUrl, tagline, xchatBrandName };
}
