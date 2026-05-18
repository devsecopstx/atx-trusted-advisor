/**
 * Shell theme + tenant branding reads: React `cache()` per request, `unstable_cache` across requests (300s).
 * Import from server-only code only.
 */
import { ObjectId } from "mongodb";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import { getCoreUserByIdCached, getTenantByHexIdCached } from "@/lib/server-request-cache";
import {
  parseXfUiThemePreferenceFromUnknown,
  type XfUiThemePreference
} from "@/lib/xf-ui-theme";
import {
  parseTenantShellBrandingFromTenant,
  parseTenantXfUiThemeFromTenant,
  type TenantShellAppearance
} from "@/modules/identity/tenant-shell-appearance";
import type { TenantShellBranding } from "@/modules/identity/tenant-shell-branding";

const SHELL_CACHE_REVALIDATE_SEC = 300;

async function readTenantShellAppearanceFromDb(tenantIdHex: string): Promise<TenantShellAppearance> {
  const tenant = await getTenantByHexIdCached(tenantIdHex);
  return {
    xfUiTheme: parseTenantXfUiThemeFromTenant(tenant),
    shellBranding: parseTenantShellBrandingFromTenant(tenant)
  };
}

const readTenantShellAppearanceCrossRequest = unstable_cache(
  readTenantShellAppearanceFromDb,
  ["identity-shell-tenant-appearance"],
  { revalidate: SHELL_CACHE_REVALIDATE_SEC }
);

/** One Mongo tenant read (deduped) for default theme + shell branding. */
export const loadTenantShellAppearanceCached = cache(
  async (tenantIdHex: string): Promise<TenantShellAppearance> => {
    const trimmed = tenantIdHex.trim();
    if (!ObjectId.isValid(trimmed)) {
      return { xfUiTheme: undefined, shellBranding: null };
    }
    return readTenantShellAppearanceCrossRequest(trimmed);
  }
);

export const getTenantXfUiThemePreferenceForHexCached = cache(
  async (tenantIdHex: string): Promise<XfUiThemePreference | undefined> => {
    const { xfUiTheme } = await loadTenantShellAppearanceCached(tenantIdHex);
    return xfUiTheme;
  }
);

export const getTenantShellBrandingForHexCached = cache(
  async (tenantIdHex: string): Promise<TenantShellBranding | null> => {
    const { shellBranding } = await loadTenantShellAppearanceCached(tenantIdHex);
    return shellBranding;
  }
);

/** Per-request dedupe only — user theme must reflect PATCH /api/user/appearance immediately. */
export const getCoreUserXfUiThemePreferenceForHexCached = cache(
  async (userIdHex: string): Promise<XfUiThemePreference | undefined> => {
    const trimmed = userIdHex.trim();
    if (!ObjectId.isValid(trimmed)) {
      return undefined;
    }
    const user = await getCoreUserByIdCached(trimmed);
    return parseXfUiThemePreferenceFromUnknown(user?.xfUiTheme);
  }
);
