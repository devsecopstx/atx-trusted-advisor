import type { TenantShellBranding } from "@/modules/identity/tenant-shell-branding";

/** Resolved tenant desk copy for product chrome (workspace = team). */
export type TenantDeskDisplayLabel = {
  /** Prefer `xchat_brandname`, else `core_tenants.name`. */
  primary: string;
  tagline?: string;
  logoUrl?: string;
};

export function resolveTenantDeskDisplayLabel(
  branding: TenantShellBranding | null | undefined,
  fallbackTenantName?: string | null
): TenantDeskDisplayLabel | null {
  const brand = branding?.xchatBrandName?.trim();
  const display = branding?.displayName?.trim();
  const fallback = fallbackTenantName?.trim();
  const primary = brand || display || fallback;
  if (!primary) {
    return null;
  }
  const tagline = branding?.tagline?.trim() || undefined;
  const logoUrl = branding?.logoUrl?.trim() || undefined;
  return { primary, tagline, logoUrl };
}
