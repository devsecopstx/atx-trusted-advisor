/** Cached option chain API payload (shape matches `/api/strategy-options`). */
export type CachedChainPayload = {
  underlying: string;
  expiration: string;
  stockPrice: number;
  dataSource: string;
  note?: string;
  optionChain: unknown[];
  error?: string;
};

type CacheEntry = { expiresAt: number; payload: CachedChainPayload };

const store = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 60_000;

export function makeOptionChainCacheKey(underlying: string, expirationYyyyMmDd: string): string {
  return `${underlying.trim().toUpperCase()}|${expirationYyyyMmDd}`;
}

export function getCachedOptionChain(
  key: string,
  nowMs: number = Date.now()
): CachedChainPayload | null {
  const e = store.get(key);
  if (!e || nowMs > e.expiresAt) {
    store.delete(key);
    return null;
  }
  return e.payload;
}

export function setCachedOptionChain(
  key: string,
  payload: CachedChainPayload,
  ttlMs: number = DEFAULT_TTL_MS,
  nowMs: number = Date.now()
): void {
  store.set(key, { expiresAt: nowMs + ttlMs, payload });
}
