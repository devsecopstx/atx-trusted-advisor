import {
    getRedisClientForPlane,
    getRedisQuoteCacheTtlClosedSeconds,
    getRedisQuoteCacheTtlSeconds
} from "@/lib/redis-client";

import type { MarketQuoteSnapshot } from "@/modules/xchat/market-quote-types";

function quoteKey(symbol: string): string {
  return `xchat:market_quote:${symbol.trim().toUpperCase()}`;
}

/**
 * Rough US equity regular-hours window in **UTC** (does not track DST — good enough for TTL tiering).
 * RTH ≈ 09:30–16:00 America/New_York → ~14:30–21:00 UTC in standard time.
 */
export function isLikelyUsEquityRegularSessionUtc(now: Date = new Date()): boolean {
  const dow = now.getUTCDay();
  if (dow === 0 || dow === 6) {
    return false;
  }
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const open = 13 * 60 + 30;
  const close = 21 * 60;
  return mins >= open && mins < close;
}

export function resolveMarketQuoteRedisTtlSeconds(now: Date = new Date()): number {
  return isLikelyUsEquityRegularSessionUtc(now)
    ? getRedisQuoteCacheTtlSeconds()
    : getRedisQuoteCacheTtlClosedSeconds();
}

export async function tryGetRedisMarketQuote(symbol: string): Promise<MarketQuoteSnapshot | null> {
  const sym = symbol.trim().toUpperCase();
  if (!sym) {
    return null;
  }
  const redis = await getRedisClientForPlane("cache");
  if (!redis) {
    return null;
  }
  try {
    const raw = await redis.get(quoteKey(sym));
    if (!raw || raw.length < 2) {
      return null;
    }
    const parsed = JSON.parse(raw) as MarketQuoteSnapshot;
    if (typeof parsed?.symbol !== "string" || parsed.symbol.toUpperCase() !== sym) {
      return null;
    }
    if (typeof parsed.price !== "number" || !Number.isFinite(parsed.price) || parsed.price <= 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function setRedisMarketQuote(
  symbol: string,
  snapshot: MarketQuoteSnapshot,
  ttlSeconds?: number
): Promise<void> {
  const sym = symbol.trim().toUpperCase();
  if (!sym) {
    return;
  }
  const redis = await getRedisClientForPlane("cache");
  if (!redis) {
    return;
  }
  const ttl = ttlSeconds ?? resolveMarketQuoteRedisTtlSeconds();
  try {
    await redis.set(quoteKey(sym), JSON.stringify(snapshot), { EX: ttl });
  } catch {
    /* non-fatal */
  }
}
