/**
 * Persist “override_active” promo-banner dismiss per signed-in identity (email).
 * Survives new browser sessions / logins until billing state is no longer `override_active`.
 */

const LEGACY_OVERRIDE_ACTIVE_DISMISS_KEY = "xf_billing_banner_dismissed_override_active";

export function overrideActiveDismissStorageKey(accountIdentity?: string | null): string {
  const id = accountIdentity?.trim().toLowerCase();
  return id ? `${LEGACY_OVERRIDE_ACTIVE_DISMISS_KEY}:${id}` : LEGACY_OVERRIDE_ACTIVE_DISMISS_KEY;
}

export function readOverrideActiveDismissed(accountIdentity?: string | null): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const scoped = overrideActiveDismissStorageKey(accountIdentity);
    if (localStorage.getItem(scoped) === "1") {
      return true;
    }
    if (!accountIdentity?.trim()) {
      return localStorage.getItem(LEGACY_OVERRIDE_ACTIVE_DISMISS_KEY) === "1";
    }
    return false;
  } catch {
    return false;
  }
}

export function writeOverrideActiveDismissed(accountIdentity?: string | null): void {
  try {
    if (accountIdentity?.trim()) {
      localStorage.setItem(overrideActiveDismissStorageKey(accountIdentity), "1");
    } else {
      localStorage.setItem(LEGACY_OVERRIDE_ACTIVE_DISMISS_KEY, "1");
    }
  } catch {
    /* ignore */
  }
}

/** Call when API reports billing state other than `override_active` so the flag resets for next override. */
export function clearOverrideActiveDismissMarkers(accountIdentity?: string | null): void {
  try {
    localStorage.removeItem(overrideActiveDismissStorageKey(accountIdentity));
    localStorage.removeItem(LEGACY_OVERRIDE_ACTIVE_DISMISS_KEY);
  } catch {
    /* ignore */
  }
}
