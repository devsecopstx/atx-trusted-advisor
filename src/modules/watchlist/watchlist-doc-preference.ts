import type { Watchlist } from "@/modules/core-admin/types";

/**
 * When multiple `portfolio_watchlists` rows match the user scope (legacy `portfolioId` vs tenant-global),
 * pick the document users expect on the desk: prefer more symbols, then canonical user-global (no portfolioId).
 */
export function pickPreferredWatchlistDocument(rows: Watchlist[]): Watchlist | null {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }
  if (rows.length === 1) {
    return rows[0] ?? null;
  }
  const sorted = [...rows].sort(compareWatchlistPreference);
  return sorted[0] ?? null;
}

function symbolCount(w: Watchlist): number {
  return Array.isArray(w.symbols) ? w.symbols.length : 0;
}

/** 1 = user-global canonical (no portfolio anchor). */
function globalScore(w: Watchlist): number {
  return w.portfolioId == null ? 1 : 0;
}

function compareWatchlistPreference(a: Watchlist, b: Watchlist): number {
  const na = symbolCount(a);
  const nb = symbolCount(b);
  if (na !== nb) {
    return nb - na;
  }
  const ga = globalScore(a);
  const gb = globalScore(b);
  if (ga !== gb) {
    return gb - ga;
  }
  const ta =
    a.updatedAt instanceof Date && !Number.isNaN(a.updatedAt.getTime()) ? a.updatedAt.getTime() : 0;
  const tb =
    b.updatedAt instanceof Date && !Number.isNaN(b.updatedAt.getTime()) ? b.updatedAt.getTime() : 0;
  if (ta !== tb) {
    return tb - ta;
  }
  const ha = a._id?.toHexString() ?? "";
  const hb = b._id?.toHexString() ?? "";
  return hb.localeCompare(ha);
}
