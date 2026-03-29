/**
 * Optional tenant-level branding aliases (admin-set once).
 */
export type TenantBrandingPreferences = {
  xchat_brandname?: string;
  xstrategybuilder_brandname?: string;
};

const BRANDING_KEYS = ["xchat_brandname", "xstrategybuilder_brandname"] as const satisfies readonly (keyof TenantBrandingPreferences)[];

function sanitizeBrandName(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, 80);
}

export function parseTenantBrandingPreferencesPayload(
  raw: unknown
): { ok: true; value: Partial<TenantBrandingPreferences> } | { ok: false; error: string } {
  if (raw === null || raw === undefined) {
    return { ok: true, value: {} };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "tenantPreferences must be an object" };
  }

  const input = raw as Record<string, unknown>;
  const value: Partial<TenantBrandingPreferences> = {};
  for (const key of BRANDING_KEYS) {
    if (input[key] === undefined) {
      continue;
    }
    const normalized = sanitizeBrandName(input[key]);
    if (!normalized) {
      return { ok: false, error: `Invalid ${key}: non-empty string required` };
    }
    value[key] = normalized;
  }
  return { ok: true, value };
}
