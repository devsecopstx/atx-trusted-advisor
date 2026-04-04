const DEFAULT_TTL_MS = 60_000;
const MAX_CACHE_SIZE = 200;

type CacheEntry = {
  result: string;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

function buildKey(userId: string, operation: string, scopeKey?: string): string {
  const scope = scopeKey?.trim() || "__default__";
  return `${userId}:${operation}:${scope}`;
}

function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

export function getCachedToolResult(
  userId: string,
  operation: string,
  scopeKey?: string
): string | null {
  const key = buildKey(userId, operation, scopeKey);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

export function setCachedToolResult(
  userId: string,
  operation: string,
  result: string,
  ttlMs: number = DEFAULT_TTL_MS,
  scopeKey?: string
): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    evictExpired();
  }
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) {
      cache.delete(firstKey);
    }
  }

  cache.set(buildKey(userId, operation, scopeKey), {
    result,
    expiresAt: Date.now() + ttlMs
  });
}

export function deleteCachedToolResult(userId: string, operation: string, scopeKey?: string): void {
  cache.delete(buildKey(userId, operation, scopeKey));
}

export function clearToolCache(): void {
  cache.clear();
}

export function getToolCacheSize(): number {
  return cache.size;
}
