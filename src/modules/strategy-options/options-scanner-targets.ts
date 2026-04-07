import { ObjectId } from "mongodb";

import type { Position, PositionOptionType, Watchlist, WatchlistSymbol } from "@/modules/core-admin/types";
import { normalizeMongoUserIdHex } from "@/modules/identity/repository";

export type OptionSide = "long" | "short";

/** Unified scan row — from `portfolio_positions` or watchlist option/strategy lines. */
export type OptionScanTarget = {
  /** Dedup key: source-specific */
  dedupKey: string;
  source: "position" | "watchlist";
  portfolioId: ObjectId;
  /** Owner user id (hex) when `source === "watchlist"` — for user-global watchlist writes. */
  watchlistOwnerUserId?: string;
  accountId?: ObjectId;
  underlying: string;
  expYmd: string;
  strike: number;
  optionType: PositionOptionType;
  /** Per-share premium: debit for long, credit magnitude for short */
  avgCost: number;
  qty: number;
  side: OptionSide;
  strategyHint?: string;
};

/** Parse Yahoo/OCC compact option ticker e.g. `TSLA260327C00370000` (right-anchored). */
export function parseOccOptionSymbol(raw: string): {
  underlying: string;
  expYmd: string;
  optionType: PositionOptionType;
  strike: number;
} | null {
  const s = raw.trim().toUpperCase();
  if (s.length < 15) {
    return null;
  }
  const strikeStr = s.slice(-8);
  const cp = s.slice(-9, -8);
  const yymmdd = s.slice(-15, -9);
  const root = s.slice(0, -15);
  if (!root || (cp !== "C" && cp !== "P")) {
    return null;
  }
  if (!/^\d{8}$/.test(strikeStr) || !/^\d{6}$/.test(yymmdd)) {
    return null;
  }
  const strikeInt = Number.parseInt(strikeStr, 10);
  if (!Number.isFinite(strikeInt) || strikeInt < 0) {
    return null;
  }
  const yy = Number.parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  const year = 2000 + yy;
  const expYmd = `${year}-${mm}-${dd}`;
  const t = Date.parse(`${expYmd}T00:00:00.000Z`);
  if (Number.isNaN(t)) {
    return null;
  }
  return {
    underlying: root,
    expYmd,
    optionType: cp === "P" ? "put" : "call",
    strike: strikeInt / 1000
  };
}

/** Inverse of {@link parseOccOptionSymbol} for Yahoo-style compact OCC tickers. */
export function buildCompactOccOptionSymbol(input: {
  underlying: string;
  expYmd: string;
  strike: number;
  optionType: PositionOptionType;
}): string | null {
  const u = input.underlying.trim().toUpperCase();
  const m = input.expYmd.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m || !u) {
    return null;
  }
  const yy = (Number(m[1]) % 100).toString().padStart(2, "0");
  const yymmdd = `${yy}${m[2]}${m[3]}`;
  const strikeInt = Math.round(input.strike * 1000);
  if (!Number.isFinite(strikeInt) || strikeInt < 0) {
    return null;
  }
  const strikeStr = strikeInt.toString().padStart(8, "0");
  const cp = input.optionType === "put" ? "P" : "C";
  return `${u}${yymmdd}${cp}${strikeStr}`;
}

function expirationYmdFromDate(exp: Date | null | undefined): string | null {
  if (!exp || !(exp instanceof Date) || Number.isNaN(exp.getTime())) {
    return null;
  }
  return exp.toISOString().slice(0, 10);
}

export function inferSideFromWatchlistStrategy(
  strategy: string | undefined,
  lineType: string | undefined,
  optionType: PositionOptionType
): OptionSide {
  const bundle = `${lineType ?? ""} ${strategy ?? ""}`.toLowerCase();
  if (optionType === "call") {
    if (
      /covered call|short call|naked call|bear call|credit call|short vertical call/.test(bundle)
    ) {
      return "short";
    }
  } else {
    if (
      /csp|cash-secured|cash secured|short put|naked put|bull put|credit put|iron condor|iron butterfly/.test(
        bundle
      )
    ) {
      return "short";
    }
  }
  if (/long (call|put)|leap|diagonal|pmcc|poor man|debit/.test(bundle)) {
    return "long";
  }
  return "long";
}

export function inferSideFromPosition(p: Position): OptionSide {
  if (typeof p.qty === "number" && p.qty < 0) {
    return "short";
  }
  return "long";
}

function watchlistRowEligible(row: WatchlistSymbol): boolean {
  const lt = (row.lineType ?? "").trim().toLowerCase();
  const st = (row.strategy ?? "").trim();
  if (lt === "option" || lt.includes("option")) {
    return true;
  }
  if (st.length > 0 && (lt.includes("strategy") || lt.includes("spread") || lt.includes("csp"))) {
    return true;
  }
  if (st.length > 0 && parseOccOptionSymbol(row.symbol)) {
    return true;
  }
  return false;
}

/** Build scan targets from user watchlists; `defaultPortfolioByUserId` maps owner user id → default book for recs/alerts. */
export function watchlistsToOptionScanTargets(
  watchlists: Watchlist[],
  limit: number,
  defaultPortfolioByUserId: Map<string, ObjectId>
): OptionScanTarget[] {
  const out: OptionScanTarget[] = [];
  for (const w of watchlists) {
    if (!w._id) {
      continue;
    }
    const userKey = normalizeMongoUserIdHex(w.userId) ?? "";
    const portfolioId = userKey ? defaultPortfolioByUserId.get(userKey) : undefined;
    if (!portfolioId) {
      continue;
    }
    for (const row of w.symbols ?? []) {
      if (out.length >= limit) {
        return out;
      }
      if (!watchlistRowEligible(row)) {
        continue;
      }
      const parsed = parseOccOptionSymbol(row.symbol);
      if (!parsed) {
        continue;
      }
      const side = inferSideFromWatchlistStrategy(row.strategy, row.lineType, parsed.optionType);
      const entry = typeof row.entryPrice === "number" && Number.isFinite(row.entryPrice) ? row.entryPrice : 1;
      const qty = typeof row.quantity === "number" && Number.isFinite(row.quantity) ? Math.abs(row.quantity) : 1;
      const dedupKey = `wl:${w._id.toHexString()}:${parsed.underlying}|${parsed.expYmd}|${parsed.strike}|${parsed.optionType}`;
      out.push({
        dedupKey,
        source: "watchlist",
        portfolioId,
        watchlistOwnerUserId: userKey,
        underlying: parsed.underlying,
        expYmd: parsed.expYmd,
        strike: parsed.strike,
        optionType: parsed.optionType,
        avgCost: Math.max(0.01, entry),
        qty,
        side,
        strategyHint: row.strategy ?? row.lineType
      });
    }
  }
  return out;
}

/** Convert portfolio option positions to scan targets. */
export function positionsToOptionScanTargets(positions: Position[]): OptionScanTarget[] {
  const out: OptionScanTarget[] = [];
  for (const p of positions) {
    const sym = (p.symbol ?? "").trim().toUpperCase();
    const expYmd = expirationYmdFromDate(p.expiration ?? null);
    const strike = typeof p.strike === "number" && Number.isFinite(p.strike) ? p.strike : null;
    const ot = p.optionType;
    if (!sym || !expYmd || strike === null || strike <= 0 || (ot !== "call" && ot !== "put")) {
      continue;
    }
    if (!p.portfolioId) {
      continue;
    }
    const side = inferSideFromPosition(p);
    const avg =
      typeof p.avgCost === "number" && Number.isFinite(p.avgCost) ? Math.abs(p.avgCost) : 1;
    const qty = typeof p.qty === "number" && Number.isFinite(p.qty) ? Math.abs(p.qty) : 1;
    const dedupKey = `pos:${p._id?.toHexString() ?? "unknown"}`;
    out.push({
      dedupKey,
      source: "position",
      portfolioId: p.portfolioId,
      accountId: p.accountId,
      underlying: sym,
      expYmd,
      strike,
      optionType: ot,
      avgCost: Math.max(0.0001, avg),
      qty,
      side
    });
  }
  return out;
}

/**
 * Contract key for alerts / dismiss / dedupe. Includes custodian account when the target is a
 * position row so the same OCC line in two accounts does not collapse alerts.
 */
export function contractKeyForTarget(t: OptionScanTarget): string {
  const base = `${t.underlying}|${t.expYmd}|${t.strike}|${t.optionType}`;
  if (t.accountId) {
    return `${base}|acct:${t.accountId.toHexString()}`;
  }
  return base;
}

function nakedContractKey(
  portfolioId: ObjectId,
  t: Pick<OptionScanTarget, "underlying" | "expYmd" | "strike" | "optionType">
): string {
  return `${portfolioId.toHexString()}:${t.underlying}|${t.expYmd}|${t.strike}|${t.optionType}`;
}

function positionMergeKey(portfolioId: ObjectId, t: OptionScanTarget): string {
  const n = nakedContractKey(portfolioId, t);
  return t.accountId ? `${n}|acct:${t.accountId.toHexString()}` : n;
}

/**
 * Merge position + watchlist targets. Positions are keyed by portfolio + contract + account
 * (when `accountId` is set) so duplicate contracts across accounts are all scanned. Watchlist
 * rows are skipped when any position exists for the same naked contract (position wins).
 */
export function mergeOptionScanTargets(
  positions: OptionScanTarget[],
  watch: OptionScanTarget[]
): OptionScanTarget[] {
  const byKey = new Map<string, OptionScanTarget>();
  const nakedHasPosition = new Set<string>();

  for (const t of positions) {
    byKey.set(positionMergeKey(t.portfolioId, t), t);
    nakedHasPosition.add(nakedContractKey(t.portfolioId, t));
  }
  for (const w of watch) {
    const n = nakedContractKey(w.portfolioId, w);
    if (nakedHasPosition.has(n)) {
      continue;
    }
    if (!byKey.has(n)) {
      byKey.set(n, w);
    }
  }
  return Array.from(byKey.values());
}
