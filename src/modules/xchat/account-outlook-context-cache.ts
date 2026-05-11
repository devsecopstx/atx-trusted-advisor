import { getRedisClientForPlane } from "@/lib/redis-client";

import type { AccountOutlookContextForXchat } from "@/modules/xchat/account-outlook-context";

const MEMORY_MAX = 200;
const memory = new Map<string, { expiresAt: number; value: string }>();

export type AccountOutlookContextCacheStats = {
  hits: number;
  misses: number;
  writes: number;
  invalidations: number;
  /** Share of lookups that hit cache on this Node process; null when no lookups yet. */
  hitRate: number | null;
  storageBackend: "redis" | "memory";
  ttlSeconds: number;
  inMemoryEntries: number;
};

let cacheHits = 0;
let cacheMisses = 0;
let cacheWrites = 0;
let cacheInvalidations = 0;

function recordCacheHit(): void {
  cacheHits += 1;
}

function recordCacheMiss(): void {
  cacheMisses += 1;
}

function recordCacheWrite(): void {
  cacheWrites += 1;
}

function recordCacheInvalidation(): void {
  cacheInvalidations += 1;
}

type CachedAccountOutlookContextPayload = Omit<
  AccountOutlookContextForXchat,
  "lastOutlookRefreshAt"
> & {
  lastOutlookRefreshAt: string | null;
};

function evictMemoryExpired(): void {
  const now = Date.now();
  for (const [k, v] of memory) {
    if (v.expiresAt <= now) {
      memory.delete(k);
    }
  }
}

/** TTL for outlook desk context (seconds). Clamped 30–900; default 120. */
export function getAccountOutlookContextCacheTtlSeconds(): number {
  const raw = process.env.REDIS_OUTLOOK_CONTEXT_TTL_SECONDS?.trim();
  if (!raw) {
    return 120;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return 120;
  }
  return Math.min(900, Math.max(30, Math.floor(n)));
}

export function buildAccountOutlookContextCacheKey(input: {
  userId: string;
  portfolioIdHex: string;
  tenantId?: string;
}): string {
  const tenant = input.tenantId?.trim() || "_";
  return `outlook:ctx:${tenant}:${input.userId.trim()}:${input.portfolioIdHex.trim()}`;
}

function serializeOutlookContext(ctx: AccountOutlookContextForXchat): string {
  const payload: CachedAccountOutlookContextPayload = {
    ...ctx,
    lastOutlookRefreshAt:
      ctx.lastOutlookRefreshAt && !Number.isNaN(ctx.lastOutlookRefreshAt.getTime())
        ? ctx.lastOutlookRefreshAt.toISOString()
        : null
  };
  return JSON.stringify(payload);
}

function deserializeOutlookContext(raw: string): AccountOutlookContextForXchat | null {
  try {
    const parsed = JSON.parse(raw) as CachedAccountOutlookContextPayload;
    if (!parsed || typeof parsed !== "object" || typeof parsed.promptInjection !== "string") {
      return null;
    }
    const lastAt =
      typeof parsed.lastOutlookRefreshAt === "string" && parsed.lastOutlookRefreshAt.trim()
        ? new Date(parsed.lastOutlookRefreshAt)
        : null;
    return {
      ...parsed,
      lastOutlookRefreshAt:
        lastAt && !Number.isNaN(lastAt.getTime()) ? lastAt : null
    };
  } catch {
    return null;
  }
}

export async function readAccountOutlookContextCache(
  key: string
): Promise<AccountOutlookContextForXchat | null> {
  const redis = await getRedisClientForPlane("cache");
  if (redis) {
    try {
      const v = await redis.get(key);
      if (v) {
        recordCacheHit();
        return deserializeOutlookContext(v);
      }
      recordCacheMiss();
      return null;
    } catch {
      recordCacheMiss();
      return null;
    }
  }
  evictMemoryExpired();
  const e = memory.get(key);
  if (!e || Date.now() >= e.expiresAt) {
    if (e) {
      memory.delete(key);
    }
    recordCacheMiss();
    return null;
  }
  recordCacheHit();
  return deserializeOutlookContext(e.value);
}

export async function writeAccountOutlookContextCache(
  key: string,
  ctx: AccountOutlookContextForXchat,
  ttlSeconds: number
): Promise<void> {
  const json = serializeOutlookContext(ctx);
  const redis = await getRedisClientForPlane("cache");
  if (redis) {
    try {
      await redis.set(key, json, { EX: ttlSeconds });
      recordCacheWrite();
    } catch {
      /* ignore */
    }
    return;
  }
  evictMemoryExpired();
  if (memory.size >= MEMORY_MAX) {
    const first = memory.keys().next().value;
    if (first !== undefined) {
      memory.delete(first);
    }
  }
  memory.set(key, { value: json, expiresAt: Date.now() + ttlSeconds * 1000 });
  recordCacheWrite();
}

export async function invalidateAccountOutlookContextCache(input: {
  userId: string;
  portfolioIdHex: string;
  tenantId?: string;
}): Promise<void> {
  const key = buildAccountOutlookContextCacheKey(input);
  const redis = await getRedisClientForPlane("cache");
  if (redis) {
    try {
      await redis.del(key);
    } catch {
      /* ignore */
    }
  }
  memory.delete(key);
  recordCacheInvalidation();
}

/** Process-local counters for Admin ops summary (per Cloud Run instance). */
export async function getAccountOutlookContextCacheStats(): Promise<AccountOutlookContextCacheStats> {
  const redis = await getRedisClientForPlane("cache");
  const lookups = cacheHits + cacheMisses;
  return {
    hits: cacheHits,
    misses: cacheMisses,
    writes: cacheWrites,
    invalidations: cacheInvalidations,
    hitRate: lookups > 0 ? cacheHits / lookups : null,
    storageBackend: redis ? "redis" : "memory",
    ttlSeconds: getAccountOutlookContextCacheTtlSeconds(),
    inMemoryEntries: memory.size
  };
}
