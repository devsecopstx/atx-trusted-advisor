/** Bounds for edge proxy in-memory TTL env vars (session grounding, billing, tenant-UX). */
const MIN_MS = 5_000;
const MAX_MS = 300_000;

/**
 * Parse millisecond TTL for `src/proxy.ts` edge caches.
 * Invalid / empty values fall back to `defaultMs`.
 */
export function parseProxyEdgeCacheTtlMs(
  raw: string | undefined,
  defaultMs: number,
  bounds?: { minMs?: number; maxMs?: number }
): number {
  const minMs = bounds?.minMs ?? MIN_MS;
  const maxMs = bounds?.maxMs ?? MAX_MS;
  if (!raw?.trim()) {
    return defaultMs;
  }
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed)) {
    return defaultMs;
  }
  return Math.min(maxMs, Math.max(minMs, parsed));
}

/** Redis TTL for origin session-grounding positive decisions (seconds). */
export function parseSessionGroundingRedisTtlSeconds(raw = process.env.SESSION_GROUNDING_REDIS_TTL_SECONDS): number {
  const DEFAULT_SEC = 60;
  const MIN_SEC = 15;
  const MAX_SEC = 300;
  if (!raw?.trim()) {
    return DEFAULT_SEC;
  }
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_SEC;
  }
  return Math.min(MAX_SEC, Math.max(MIN_SEC, parsed));
}
