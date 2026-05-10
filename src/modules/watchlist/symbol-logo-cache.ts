import { getRedisClientForPlane } from "@/lib/redis-client";

import { defaultWatchlistLogoUrl, equityLogoKeyRoot } from "@/modules/watchlist/equity-logo-url";

/** Bump when {@link defaultWatchlistLogoUrl} source changes (invalidates stale CDN URLs in Redis). */
const REDIS_KEY_PREFIX = "xf:equity:logo:v2:";

/** In-process cache so hot paths avoid Redis round-trips after first resolve. */
const memoryByRoot = new Map<string, { url: string; expiresAt: number }>();
const MEMORY_TTL_MS = 24 * 60 * 60 * 1000;
const MEMORY_KEY_VER = "fool1:";

/** Redis TTL for resolved logo URLs (seconds). Default 7d; clamp 60s–30d. */
export function getRedisLogoCacheTtlSeconds(): number {
  const raw = process.env.REDIS_LOGO_CACHE_TTL_SECONDS?.trim();
  if (!raw) {
    return 7 * 24 * 3600;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return 7 * 24 * 3600;
  }
  return Math.min(30 * 24 * 3600, Math.max(60, Math.floor(n)));
}

/**
 * Returns the canonical Fool CDN logo URL for this symbol, using Redis + in-memory cache keyed by
 * equity root (so option legs share one entry with the underlying).
 */
export async function resolveCachedEquityLogoUrl(normalizedSymbolUpper: string): Promise<string | undefined> {
  const root = equityLogoKeyRoot(normalizedSymbolUpper);
  if (!root) {
    return undefined;
  }

  const now = Date.now();
  const memKey = `${MEMORY_KEY_VER}${root}`;
  const mem = memoryByRoot.get(memKey);
  if (mem && mem.expiresAt > now) {
    return mem.url;
  }

  const redis = await getRedisClientForPlane("cache");
  if (redis) {
    try {
      const hit = await redis.get(`${REDIS_KEY_PREFIX}${root}`);
      if (hit) {
        memoryByRoot.set(memKey, { url: hit, expiresAt: now + MEMORY_TTL_MS });
        return hit;
      }
    } catch {
      /* non-fatal */
    }
  }

  const url = defaultWatchlistLogoUrl(normalizedSymbolUpper);
  if (!url) {
    return undefined;
  }

  memoryByRoot.set(memKey, { url, expiresAt: now + MEMORY_TTL_MS });
  if (redis) {
    try {
      await redis.set(`${REDIS_KEY_PREFIX}${root}`, url, { EX: getRedisLogoCacheTtlSeconds() });
    } catch {
      /* non-fatal */
    }
  }

  return url;
}

/** Vitest-only: clear in-process logo cache. */
export function resetSymbolLogoMemoryCacheForTests(): void {
  memoryByRoot.clear();
}
