import type { TenantPreferences } from "@/modules/identity/tenant-branding-preferences";

/** Guest marketing landing audience (UTM / tenant branding). */
export type GuestLandingVariant = "hnwi" | "advisor";

export const GUEST_LANDING_FOR_QUERY = "for";
export const GUEST_LANDING_COOKIE = "xf_guest_landing_for";
export const GUEST_LANDING_AUDIENCE_PREF_KEY = "guest_landing_audience";

const VARIANTS: readonly GuestLandingVariant[] = ["hnwi", "advisor"];

export function isGuestLandingVariant(raw: unknown): raw is GuestLandingVariant {
  return typeof raw === "string" && (VARIANTS as readonly string[]).includes(raw);
}

/** Parse `?for=hnwi` or `?for=advisor` (aliases: retail → hnwi, ia / firm / rep → advisor). */
export function parseGuestLandingForParam(raw: string | null | undefined): GuestLandingVariant | null {
  if (!raw) {
    return null;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "hnwi" || normalized === "retail" || normalized === "hnwi-retail") {
    return "hnwi";
  }
  if (
    normalized === "advisor" ||
    normalized === "ia" ||
    normalized === "firm" ||
    normalized === "rep" ||
    normalized === "reps"
  ) {
    return "advisor";
  }
  return null;
}

export function parseGuestLandingAudienceFromTenantPreferences(
  tenantPreferences: TenantPreferences | Record<string, unknown> | null | undefined
): GuestLandingVariant | null {
  const raw = tenantPreferences?.[GUEST_LANDING_AUDIENCE_PREF_KEY];
  return isGuestLandingVariant(raw) ? raw : null;
}

export type ResolveGuestLandingVariantInput = {
  queryFor?: GuestLandingVariant | null;
  cookieFor?: GuestLandingVariant | null;
  tenantAudience?: GuestLandingVariant | null;
  /** Default when nothing else matches — Austin HNWI retail blast. */
  fallback?: GuestLandingVariant;
};

/**
 * Precedence: explicit query → persisted cookie → tenant `guest_landing_audience` → fallback (`hnwi`).
 */
export function resolveGuestLandingVariant(input: ResolveGuestLandingVariantInput): GuestLandingVariant {
  if (input.queryFor) {
    return input.queryFor;
  }
  if (input.cookieFor) {
    return input.cookieFor;
  }
  if (input.tenantAudience) {
    return input.tenantAudience;
  }
  return input.fallback ?? "hnwi";
}

export function guestLandingCanonicalPath(variant: GuestLandingVariant, base: "/" | "/home" = "/"): string {
  const path = base === "/home" ? "/home" : "/";
  return `${path}?${GUEST_LANDING_FOR_QUERY}=${variant}`;
}

/**
 * Unauthenticated login `next` candidate — preserves deep links; callers still fall back to `/xchat`
 * when `isSafeOAuthReturnPath` rejects the path. xChat / xOptions / portfolio guest shells are
 * served at the original URL via `allowsGuestHtmlRender` in `src/proxy.ts`.
 */
export function resolveGuestProtectedLoginNext(pathname: string, search: string): string {
  return `${pathname}${search}`;
}
