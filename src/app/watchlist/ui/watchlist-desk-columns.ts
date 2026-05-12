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
  "quickScore",
  "actions"
] as const;

/** Grid track per column — keep in sync with `.xf-watchlist-table--virtual` fallback in watchlist.css */
export const WATCHLIST_DESK_GRID_TRACKS: Record<WatchlistDeskColumnId, string> = {
  icon: "2.5rem",
  symbolLeg: "minmax(5.5rem, 1fr)",
  spot: "minmax(3.85rem, 0.62fr)",
  ivRank: "minmax(3.65rem, 0.58fr)",
  volOi: "minmax(3.45rem, 0.54fr)",
  rsi: "minmax(2.95rem, 0.42fr)",
  targetEntry: "minmax(4.15rem, 0.62fr)",
  riskPct: "minmax(3.25rem, 0.48fr)",
  quickScore: "minmax(2.65rem, 0.4fr)",
  rationale: "minmax(7rem, 1.05fr)",
  status: "minmax(4.75rem, 0.68fr)",
  actions: "minmax(4.25rem, 0.68fr)"
};

/** Tighter min tracks for tablet / narrow desk viewports — keep in sync with compact rules in watchlist.css */
export const WATCHLIST_DESK_GRID_TRACKS_COMPACT: Record<WatchlistDeskColumnId, string> = {
  icon: "2.1rem",
  symbolLeg: "minmax(4.75rem, 0.95fr)",
  spot: "minmax(3.15rem, 0.58fr)",
  ivRank: "minmax(2.95rem, 0.5fr)",
  volOi: "minmax(2.8rem, 0.48fr)",
  rsi: "minmax(2.55rem, 0.38fr)",
  targetEntry: "minmax(3.65rem, 0.56fr)",
  riskPct: "minmax(2.75rem, 0.42fr)",
  quickScore: "minmax(2.45rem, 0.36fr)",
  rationale: "minmax(5.75rem, 0.9fr)",
  status: "minmax(3.85rem, 0.58fr)",
  actions: "minmax(3.35rem, 0.58fr)"
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
  rationale: true,
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
  status: "Status",
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

export function deskGridTemplateColumns(
  visibleIds: readonly WatchlistDeskColumnId[],
  compact = false
): string {
  const tracks = compact ? WATCHLIST_DESK_GRID_TRACKS_COMPACT : WATCHLIST_DESK_GRID_TRACKS;
  return visibleIds.map((id) => tracks[id]).join(" ");
}

export function visibleDeskColumnIds(visibility: VisibilityState): WatchlistDeskColumnId[] {
  return WATCHLIST_DESK_COLUMN_ORDER.filter((id) => {
    if (!WATCHLIST_DESK_COLUMN_HIDEABLE[id]) {
      return true;
    }
    return visibility[id] !== false;
  });
}
