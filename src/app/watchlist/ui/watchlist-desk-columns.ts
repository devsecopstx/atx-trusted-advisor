import type { VisibilityState } from "@tanstack/react-table";

export const WATCHLIST_DESK_COLUMN_VISIBILITY_STORAGE_KEY = "xf-watchlist-desk-column-visibility-v1";

export type WatchlistDeskColumnId =
  | "icon"
  | "symbolLeg"
  | "spot"
  | "ivRank"
  | "volOi"
  | "rsi"
  | "targetEntry"
  | "riskPct"
  | "quickScore"
  | "rationale"
  | "status"
  | "actions";

/** Desktop column order (left → right). */
export const WATCHLIST_DESK_COLUMN_ORDER: readonly WatchlistDeskColumnId[] = [
  "icon",
  "symbolLeg",
  "spot",
  "ivRank",
  "volOi",
  "rsi",
  "targetEntry",
  "riskPct",
  "quickScore",
  "rationale",
  "status",
  "actions"
] as const;

/** Grid track per column — keep in sync with `.xf-watchlist-table--virtual` fallback in watchlist.css */
export const WATCHLIST_DESK_GRID_TRACKS: Record<WatchlistDeskColumnId, string> = {
  icon: "3rem",
  symbolLeg: "minmax(7rem, 1.45fr)",
  spot: "minmax(4.75rem, 0.85fr)",
  ivRank: "minmax(4.5rem, 0.72fr)",
  volOi: "minmax(4.25rem, 0.68fr)",
  rsi: "minmax(3.6rem, 0.52fr)",
  targetEntry: "minmax(5.25rem, 0.78fr)",
  riskPct: "minmax(3.85rem, 0.58fr)",
  quickScore: "minmax(3.35rem, 0.52fr)",
  rationale: "minmax(8.5rem, 1.25fr)",
  status: "minmax(5.75rem, 0.82fr)",
  actions: "minmax(6.25rem, 1fr)"
};

export const WATCHLIST_DESK_COLUMN_HIDEABLE: Record<WatchlistDeskColumnId, boolean> = {
  icon: false,
  symbolLeg: false,
  spot: true,
  ivRank: true,
  volOi: true,
  rsi: true,
  targetEntry: true,
  riskPct: true,
  quickScore: true,
  rationale: false,
  status: true,
  actions: false
};

export const WATCHLIST_DESK_COLUMN_LABELS: Record<WatchlistDeskColumnId, string> = {
  icon: "Icon",
  symbolLeg: "Symbol + leg",
  spot: "Spot",
  ivRank: "IV · rank",
  volOi: "Vol · OI",
  rsi: "RSI(14)",
  targetEntry: "Target entry",
  riskPct: "% book risk",
  quickScore: "Quick score",
  rationale: "Rationale",
  status: "Status + catalyst",
  actions: "Actions"
};

export function mergeDeskColumnVisibility(stored: VisibilityState | undefined): VisibilityState {
  const next: VisibilityState = { ...(stored ?? {}) };
  for (const id of WATCHLIST_DESK_COLUMN_ORDER) {
    if (!WATCHLIST_DESK_COLUMN_HIDEABLE[id]) {
      delete next[id];
    }
  }
  return next;
}

export function readDeskColumnVisibilityFromStorage(): VisibilityState {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(WATCHLIST_DESK_COLUMN_VISIBILITY_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return mergeDeskColumnVisibility(parsed as VisibilityState);
  } catch {
    return {};
  }
}

export function deskGridTemplateColumns(visibleIds: readonly WatchlistDeskColumnId[]): string {
  return visibleIds.map((id) => WATCHLIST_DESK_GRID_TRACKS[id]).join(" ");
}

export function visibleDeskColumnIds(visibility: VisibilityState): WatchlistDeskColumnId[] {
  return WATCHLIST_DESK_COLUMN_ORDER.filter((id) => {
    if (!WATCHLIST_DESK_COLUMN_HIDEABLE[id]) {
      return true;
    }
    return visibility[id] !== false;
  });
}
