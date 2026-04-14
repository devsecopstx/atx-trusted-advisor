import { canonicalMongoObjectIdHex, isLikelyMongoObjectIdHex } from "@/lib/mongo-object-id-hex";

/** Matches xOptions strategy builder input validation (underlyings). */
const UNDERLYING_RE = /^[A-Z0-9.\-]{1,10}$/;

export function isValidXoptionsUnderlyingSymbol(raw: string): boolean {
  const s = raw.trim().toUpperCase();
  return UNDERLYING_RE.test(s);
}

export function normalizeXoptionsUnderlyingSymbol(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Open the strategy builder on `/xoptions` with optional desk scope + symbol.
 * `portfolioId` must be 24-char hex when present (workspace cookie sync on xOptions load).
 */
export function buildXoptionsStrategyBuilderHref(portfolioId: string | null | undefined, symbol: string): string {
  const s = normalizeXoptionsUnderlyingSymbol(symbol);
  if (!isValidXoptionsUnderlyingSymbol(s)) {
    return "/xoptions";
  }
  const q = new URLSearchParams({ symbol: s });
  const pid = portfolioId?.trim() ?? "";
  if (pid && isLikelyMongoObjectIdHex(pid)) {
    q.set("portfolioId", canonicalMongoObjectIdHex(pid));
  }
  return `/xoptions?${q.toString()}`;
}
