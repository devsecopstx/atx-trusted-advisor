import { daysToExpirationFromYmd } from "@/modules/strategy-options/options-scanner-engine";
import type { OptionScanTarget } from "@/modules/strategy-options/options-scanner-targets";

export type MergedScannerFilters = {
  underlyingDenylist: Set<string>;
  /** Union of allowlists when any strategy defines one; `null` means no allowlist constraint. */
  underlyingAllowlist: Set<string> | null;
  /** Tightest lower bound across strategies that set `minDte`. */
  minDte: number | null;
  /** Tightest upper bound across strategies that set `maxDte`. */
  maxDte: number | null;
  /** Highest `minIvRankPct` across strategies (IV rank floor for premium scans). */
  minIvRankPct: number | null;
  optionTypes: Set<"call" | "put"> | null;
  sources: Set<"position" | "watchlist"> | null;
};

const EMPTY: MergedScannerFilters = {
  underlyingDenylist: new Set(),
  underlyingAllowlist: null,
  minDte: null,
  maxDte: null,
  minIvRankPct: null,
  optionTypes: null,
  sources: null
};

/**
 * Merges `filters` JSON from `options_strategy` docs (admin-editable).
 * Schema (documented in `atx-docs/design-system/scheduled-task/options-scanner.md`):
 * - `underlyingDenylist`: string[] tickers (uppercased)
 * - `underlyingAllowlist`: string[] — union across strategies; if any row sets a non-empty allowlist, targets must be in the union
 * - `minDte` / `maxDte`: number — combined as max(minDte) and min(maxDte)
 * - `minIvRankPct`: number — combined as max(minIvRankPct) across strategies
 * - `optionTypes`: ("call"|"put")[]
 * - `sources`: ("position"|"watchlist")[]
 */
export function mergeOptionsStrategyFilters(
  rows: ReadonlyArray<{ slug: string; filters: Record<string, unknown> | null | undefined }>
): MergedScannerFilters {
  if (rows.length === 0) {
    return EMPTY;
  }

  const deny = new Set<string>();
  const allowChunks: string[][] = [];
  let minDte: number | null = null;
  let maxDte: number | null = null;
  let minIvRankPct: number | null = null;
  const optTypes = new Set<"call" | "put">();
  const sources = new Set<"position" | "watchlist">();

  for (const row of rows) {
    const f = row.filters;
    if (!f || typeof f !== "object") {
      continue;
    }
    const d = f.underlyingDenylist;
    if (Array.isArray(d)) {
      for (const x of d) {
        if (typeof x === "string" && x.trim()) {
          deny.add(x.trim().toUpperCase());
        }
      }
    }
    const a = f.underlyingAllowlist;
    if (Array.isArray(a) && a.length > 0) {
      allowChunks.push(
        a.map((x) => (typeof x === "string" ? x.trim().toUpperCase() : "")).filter(Boolean)
      );
    }
    const mn = f.minDte;
    if (typeof mn === "number" && Number.isFinite(mn)) {
      minDte = minDte === null ? mn : Math.max(minDte, mn);
    }
    const mx = f.maxDte;
    if (typeof mx === "number" && Number.isFinite(mx)) {
      maxDte = maxDte === null ? mx : Math.min(maxDte, mx);
    }
    const ivFloor = f.minIvRankPct ?? f.minIvRank ?? f.ivRankMinPct;
    if (typeof ivFloor === "number" && Number.isFinite(ivFloor)) {
      const pct = Math.round(Math.max(1, Math.min(99, ivFloor)));
      minIvRankPct = minIvRankPct === null ? pct : Math.max(minIvRankPct, pct);
    }
    const ot = f.optionTypes;
    if (Array.isArray(ot)) {
      for (const t of ot) {
        if (t === "call" || t === "put") {
          optTypes.add(t);
        }
      }
    }
    const src = f.sources;
    if (Array.isArray(src)) {
      for (const s of src) {
        if (s === "position" || s === "watchlist") {
          sources.add(s);
        }
      }
    }
  }

  let allowUnion: Set<string> | null = null;
  if (allowChunks.length > 0) {
    allowUnion = new Set(allowChunks.flat());
  }

  return {
    underlyingDenylist: deny,
    underlyingAllowlist: allowUnion,
    minDte,
    maxDte,
    minIvRankPct,
    optionTypes: optTypes.size > 0 ? optTypes : null,
    sources: sources.size > 0 ? sources : null
  };
}

export function mergedScannerFiltersActive(m: MergedScannerFilters): boolean {
  return (
    m.underlyingDenylist.size > 0 ||
    (m.underlyingAllowlist !== null && m.underlyingAllowlist.size > 0) ||
    m.minDte !== null ||
    m.maxDte !== null ||
    m.minIvRankPct !== null ||
    (m.optionTypes !== null && m.optionTypes.size > 0) ||
    (m.sources !== null && m.sources.size > 0)
  );
}

export function optionScanTargetPassesMergedFilters(
  t: OptionScanTarget,
  m: MergedScannerFilters
): boolean {
  const u = t.underlying.trim().toUpperCase();
  if (m.underlyingDenylist.has(u)) {
    return false;
  }
  if (m.underlyingAllowlist && m.underlyingAllowlist.size > 0 && !m.underlyingAllowlist.has(u)) {
    return false;
  }
  const dte = daysToExpirationFromYmd(t.expYmd);
  if (m.minDte !== null && dte < m.minDte) {
    return false;
  }
  if (m.maxDte !== null && dte > m.maxDte) {
    return false;
  }
  if (m.optionTypes && !m.optionTypes.has(t.optionType)) {
    return false;
  }
  if (m.sources && !m.sources.has(t.source)) {
    return false;
  }
  return true;
}

export function filterOptionScanTargetsByMergedPrefs(
  targets: OptionScanTarget[],
  m: MergedScannerFilters
): OptionScanTarget[] {
  return targets.filter((t) => optionScanTargetPassesMergedFilters(t, m));
}
