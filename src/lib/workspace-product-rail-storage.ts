/** localStorage key — `"1"` expanded, missing/other collapsed (desktop lg workspace product rail). */
export const RAIL_EXPANDED_STORAGE_KEY = "xf-workspace-product-rail-expanded";

/** Fired after preference writes so `useSyncExternalStore` subscribers re-read. */
export const WORKSPACE_PRODUCT_RAIL_PREFS_CHANGE = "xf-workspace-product-rail-prefs-change";

export function getRailExpandedSnapshot(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(RAIL_EXPANDED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Expand the workspace product rail and persist (e.g. xChat `?rail=` deep links). */
export function expandWorkspaceProductRail(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(RAIL_EXPANDED_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(WORKSPACE_PRODUCT_RAIL_PREFS_CHANGE));
}

/** Collapse the workspace product rail and persist (e.g. default `/xchat` entry after login). */
export function collapseWorkspaceProductRail(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(RAIL_EXPANDED_STORAGE_KEY, "0");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(WORKSPACE_PRODUCT_RAIL_PREFS_CHANGE));
}
