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
