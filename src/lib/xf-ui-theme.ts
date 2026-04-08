export type XfUiThemePreference = "light" | "dark" | "system";

/** Resolved shell density applied to `html[data-xf-ui]`. Still dark-mode only. */
export type XfUiDensity = "soft" | "deep";

export const XF_UI_THEME_STORAGE_KEY = "xf-ui-theme";

export const DEFAULT_XF_UI_THEME_PREFERENCE: XfUiThemePreference = "dark";

export function resolveXfUiDensity(pref: XfUiThemePreference, prefersColorSchemeLight: boolean): XfUiDensity {
  if (pref === "system") {
    return prefersColorSchemeLight ? "soft" : "deep";
  }
  return pref === "light" ? "soft" : "deep";
}

export function parseXfUiThemePreference(raw: string | null): XfUiThemePreference {
  if (raw === "light" || raw === "dark" || raw === "system") {
    return raw;
  }
  return DEFAULT_XF_UI_THEME_PREFERENCE;
}

/** Parse tenant YAML / admin payload; invalid values are rejected by callers. */
export function parseXfUiThemePreferenceFromUnknown(
  raw: unknown
): XfUiThemePreference | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : String(raw).trim().toLowerCase();
  if (s === "light" || s === "dark" || s === "system") {
    return s;
  }
  return undefined;
}

/**
 * Persists default when `localStorage` has no preference yet (first visit).
 * `tenantDefault` wins over product default when the user has not chosen a theme.
 */
export function seedDefaultXfUiThemePreferenceIfUnset(
  tenantDefault?: XfUiThemePreference
): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (window.localStorage.getItem(XF_UI_THEME_STORAGE_KEY) === null) {
      const initial = tenantDefault ?? DEFAULT_XF_UI_THEME_PREFERENCE;
      window.localStorage.setItem(XF_UI_THEME_STORAGE_KEY, initial);
      dispatchXfUiThemeChange();
    }
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Root shell bootstrap: when the signed-in session tenant has `tenantPreferences.xf_ui_theme`,
 * align `localStorage` every load (tenant register / admin policy is source of truth).
 * When the tenant omits it, only seed the product default if the user has never stored a preference.
 */
export function bootstrapXfUiThemeWithOptionalTenantDefault(
  tenantConfiguredTheme: XfUiThemePreference | undefined
): void {
  if (typeof window === "undefined") {
    return;
  }
  if (tenantConfiguredTheme !== undefined) {
    try {
      window.localStorage.setItem(XF_UI_THEME_STORAGE_KEY, tenantConfiguredTheme);
      dispatchXfUiThemeChange();
    } catch {
      /* ignore quota / private mode */
    }
    return;
  }
  seedDefaultXfUiThemePreferenceIfUnset(undefined);
}

export function readXfUiThemePreferenceFromStorage(): XfUiThemePreference {
  if (typeof window === "undefined") {
    return DEFAULT_XF_UI_THEME_PREFERENCE;
  }
  try {
    return parseXfUiThemePreference(window.localStorage.getItem(XF_UI_THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_XF_UI_THEME_PREFERENCE;
  }
}

export function applyXfUiToDocument(pref: XfUiThemePreference): XfUiDensity {
  const prefersLight =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches;
  const density = resolveXfUiDensity(pref, prefersLight);
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-xf-ui", density);
    document.documentElement.setAttribute("data-xf-theme-pref", pref);
  }
  return density;
}

export const XF_UI_THEME_CHANGE_EVENT = "xf-ui-theme-change";

export function dispatchXfUiThemeChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(XF_UI_THEME_CHANGE_EVENT));
  }
}

export function subscribeXfUiThemePreference(onChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === XF_UI_THEME_STORAGE_KEY || e.key === null) {
      onChange();
    }
  };
  const onCustom = () => onChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(XF_UI_THEME_CHANGE_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(XF_UI_THEME_CHANGE_EVENT, onCustom);
  };
}

export function getXfUiThemePreferenceSnapshot(): XfUiThemePreference {
  return readXfUiThemePreferenceFromStorage();
}
