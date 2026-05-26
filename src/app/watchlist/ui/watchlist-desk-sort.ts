import { heuristicIvPercentile } from "@/app/watchlist/ui/watchlist-metrics";

/** Row shape required for desk table sorting (watchlist console rows satisfy this). */
export type WatchlistDeskSortRow = {
  symbol: string;
  entryPrice?: number | null;
  quote?: { price?: number | null; changePercent?: number | null } | null;
  chainGlance?: {
    impliedVolatilityPercent?: number | null;
    openInterest?: number | null;
    optionVolume?: number | null;
    expirationDate?: string | null;
  } | null;
  technicals?: { rsi14?: number | null } | null;
};

export type WatchlistDeskSortColumn =
  | "symbol"
  | "spot"
  | "targetEntry"
  | "iv"
  | "ivRank"
  | "optionsVolume"
  | "oi"
  | "dayPct"
  | "distToTarget"
  | "quickScore";

export type WatchlistDeskSortState = {
  column: WatchlistDeskSortColumn;
  dir: "asc" | "desc";
};

export const WATCHLIST_DESK_DEFAULT_SORT: WatchlistDeskSortState = {
  column: "symbol",
  dir: "asc"
};

/** Primary columns exposed in mobile sort control. */
export const WATCHLIST_DESK_PRIMARY_SORT_OPTIONS: ReadonlyArray<{
  column: "symbol" | "spot" | "quickScore";
  ascLabel: string;
  descLabel: string;
}> = [
  { column: "symbol", ascLabel: "Symbol A → Z", descLabel: "Symbol Z → A" },
  { column: "spot", ascLabel: "Spot low → high", descLabel: "Spot high → low" },
  { column: "quickScore", ascLabel: "Quick score low → high", descLabel: "Quick score high → low" }
];

export function toggleWatchlistDeskSort(
  prev: WatchlistDeskSortState,
  column: WatchlistDeskSortColumn
): WatchlistDeskSortState {
  if (prev.column === column) {
    return { column, dir: prev.dir === "asc" ? "desc" : "asc" };
  }
  return { column, dir: column === "symbol" ? "asc" : "desc" };
}

function tieSymbol<T extends WatchlistDeskSortRow>(a: T, b: T): number {
  return a.symbol.localeCompare(b.symbol, undefined, { sensitivity: "base" });
}

function compareNumericColumn<T extends WatchlistDeskSortRow>(
  mult: number,
  va: number | null,
  vb: number | null,
  a: T,
  b: T
): number {
  if (va === null && vb === null) {
    return tieSymbol(a, b);
  }
  if (va === null) {
    return 1;
  }
  if (vb === null) {
    return -1;
  }
  const cmp = va - vb;
  if (cmp !== 0) {
    return mult * cmp;
  }
  return tieSymbol(a, b);
}

export function getWatchlistTargetEntryNumeric(row: WatchlistDeskSortRow): number | null {
  const entry = row.entryPrice;
  if (typeof entry === "number" && Number.isFinite(entry) && entry > 0) {
    return Math.round(100 * entry);
  }
  const px = row.quote?.price;
  if (typeof px === "number" && Number.isFinite(px)) {
    return Math.round(100 * px);
  }
  return null;
}

function getSpotSortValue(row: WatchlistDeskSortRow): number | null {
  const px = row.quote?.price;
  return px != null && Number.isFinite(px) ? px : null;
}

function getIvSortValue(row: WatchlistDeskSortRow): number | null {
  const iv = row.chainGlance?.impliedVolatilityPercent;
  return iv != null && Number.isFinite(iv) ? iv : null;
}

export function getWatchlistIvRankSortValue(row: WatchlistDeskSortRow): number | null {
  const iv = row.chainGlance?.impliedVolatilityPercent;
  if (iv == null || !Number.isFinite(iv)) {
    return null;
  }
  return heuristicIvPercentile(iv);
}

function getOiSortValue(row: WatchlistDeskSortRow): number | null {
  const oi = row.chainGlance?.openInterest;
  return oi != null && Number.isFinite(oi) ? oi : null;
}

export function getWatchlistOptionVolumeSortValue(row: WatchlistDeskSortRow): number | null {
  const vol = row.chainGlance?.optionVolume;
  return vol != null && Number.isFinite(vol) ? vol : null;
}

function getDayPctSortValue(row: WatchlistDeskSortRow): number | null {
  const p = row.quote?.changePercent;
  return p != null && Number.isFinite(p) ? p : null;
}

export function watchlistDistToTargetPct(row: WatchlistDeskSortRow): number | null {
  const spot = row.quote?.price;
  const target = row.entryPrice;
  if (
    spot == null ||
    target == null ||
    !Number.isFinite(spot) ||
    !Number.isFinite(target) ||
    spot <= 0 ||
    target <= 0
  ) {
    return null;
  }
  return ((target - spot) / spot) * 100;
}

export function watchlistQuickScore(row: WatchlistDeskSortRow): number | null {
  const ivRank = getWatchlistIvRankSortValue(row);
  const oi = row.chainGlance?.openInterest;
  const volume = row.chainGlance?.optionVolume;
  if (ivRank == null || oi == null || volume == null || !Number.isFinite(oi) || !Number.isFinite(volume)) {
    return null;
  }
  const dist = watchlistDistToTargetPct(row);
  const targetProximity = dist == null ? 0.5 : Math.max(0, 1 - Math.min(Math.abs(dist), 25) / 25);
  const rsi = row.technicals?.rsi14;
  const rsiSignal =
    rsi == null || !Number.isFinite(rsi) ? 0.35 : rsi < 30 || rsi > 70 ? 1 : Math.abs(rsi - 50) / 25;
  const catalyst = row.chainGlance?.expirationDate;
  const catalystScore = catalyst ? 1 : 0.35;
  const liquidity = Math.min(1, Math.log1p(Math.max(0, oi) + Math.max(0, volume)) / Math.log1p(250_000));
  const score01 =
    (ivRank / 100) * 0.28 +
    liquidity * 0.3 +
    targetProximity * 0.2 +
    rsiSignal * 0.12 +
    catalystScore * 0.1;
  return Math.round(score01 * 100);
}

export function applyWatchlistDeskSort<T extends WatchlistDeskSortRow>(
  list: T[],
  sortColumn: WatchlistDeskSortColumn,
  sortDir: "asc" | "desc"
): T[] {
  const mult = sortDir === "asc" ? 1 : -1;
  const out = [...list];
  out.sort((a, b) => {
    if (sortColumn === "symbol") {
      return mult * tieSymbol(a, b);
    }
    if (sortColumn === "spot") {
      return compareNumericColumn(mult, getSpotSortValue(a), getSpotSortValue(b), a, b);
    }
    if (sortColumn === "targetEntry") {
      return compareNumericColumn(mult, getWatchlistTargetEntryNumeric(a), getWatchlistTargetEntryNumeric(b), a, b);
    }
    if (sortColumn === "iv") {
      return compareNumericColumn(mult, getIvSortValue(a), getIvSortValue(b), a, b);
    }
    if (sortColumn === "ivRank") {
      return compareNumericColumn(mult, getWatchlistIvRankSortValue(a), getWatchlistIvRankSortValue(b), a, b);
    }
    if (sortColumn === "optionsVolume") {
      return compareNumericColumn(
        mult,
        getWatchlistOptionVolumeSortValue(a),
        getWatchlistOptionVolumeSortValue(b),
        a,
        b
      );
    }
    if (sortColumn === "oi") {
      return compareNumericColumn(mult, getOiSortValue(a), getOiSortValue(b), a, b);
    }
    if (sortColumn === "dayPct") {
      return compareNumericColumn(mult, getDayPctSortValue(a), getDayPctSortValue(b), a, b);
    }
    if (sortColumn === "distToTarget") {
      return compareNumericColumn(mult, watchlistDistToTargetPct(a), watchlistDistToTargetPct(b), a, b);
    }
    if (sortColumn === "quickScore") {
      return compareNumericColumn(mult, watchlistQuickScore(a), watchlistQuickScore(b), a, b);
    }
    return tieSymbol(a, b);
  });
  return out;
}
