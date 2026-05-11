import { createHash } from "node:crypto";

import { getRedisClientForPlane } from "@/lib/redis-client";

const MEMORY_MAX = 200;
const memory = new Map<string, { expiresAt: number; value: string }>();

function evictMemoryExpired(): void {
  const now = Date.now();
  for (const [k, v] of memory) {
    if (v.expiresAt <= now) {
      memory.delete(k);
    }
  }
}

/**
 * TTL for Redis-backed `options_scan` cache (seconds). Clamped 5–600; default 60.
 * Yahoo option chain payloads change slowly intraday; 60 s is a safe default that
 * still avoids stale prices for RTH-driven decisions.
 */
export function getOptionsScanCacheTtlSeconds(): number {
  const raw = process.env.REDIS_OPTIONS_SCAN_CACHE_TTL_SECONDS?.trim();
  if (!raw) {
    return 60;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return 60;
  }
  return Math.min(600, Math.max(5, Math.floor(n)));
}

export type OptionsScanFingerprintInput = {
  symbol: string;
  filters: Record<string, unknown>;
};

/** Stable fingerprint shared by Redis key + per-request dedup tracker. */
export function buildOptionsScanFingerprint(input: OptionsScanFingerprintInput): string {
  const sym = input.symbol.trim().toUpperCase();
  const filtersJson = JSON.stringify(input.filters ?? {});
  return createHash("sha256").update(`${sym}\n${filtersJson}`).digest("hex").slice(0, 32);
}

function buildKey(fingerprint: string): string {
  return `xf:xchat:options_scan:v1:${fingerprint}`;
}

export async function tryGetOptionsScanCache(fingerprint: string): Promise<string | null> {
  const key = buildKey(fingerprint);
  const redis = await getRedisClientForPlane("cache");
  if (redis) {
    try {
      const raw = await redis.get(key);
      return typeof raw === "string" && raw.length > 0 ? raw : null;
    } catch {
      return null;
    }
  }
  evictMemoryExpired();
  const e = memory.get(key);
  if (!e || Date.now() >= e.expiresAt) {
    if (e) {
      memory.delete(key);
    }
    return null;
  }
  return e.value;
}

export async function setOptionsScanCache(
  fingerprint: string,
  serializedPayload: string,
  ttlSeconds: number = getOptionsScanCacheTtlSeconds()
): Promise<void> {
  if (ttlSeconds <= 0) {
    return;
  }
  const key = buildKey(fingerprint);
  const redis = await getRedisClientForPlane("cache");
  if (redis) {
    try {
      await redis.set(key, serializedPayload, { EX: ttlSeconds });
    } catch {
      /* ignore */
    }
    return;
  }
  evictMemoryExpired();
  if (memory.size >= MEMORY_MAX) {
    const first = memory.keys().next().value as string | undefined;
    if (first) {
      memory.delete(first);
    }
  }
  memory.set(key, { value: serializedPayload, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/** Test helper. */
export function __resetOptionsScanCacheForTest(): void {
  memory.clear();
}
