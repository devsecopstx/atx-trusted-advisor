import { getRedisClientForPlane } from "@/lib/redis-client";
import { parseSessionGroundingRedisTtlSeconds } from "@/lib/proxy-edge-cache-ttl";

const REDIS_KEY_PREFIX = "atx:session-grounding:ok:v1:";
const MEMORY_TTL_MS = parseSessionGroundingRedisTtlSeconds() * 1000;

const memoryOkCache = new Map<string, { expiresAt: number }>();

function cacheKey(userId: string, tenantId: string): string {
  return `${REDIS_KEY_PREFIX}${userId.trim()}:${tenantId.trim()}`;
}

function readMemoryOk(userId: string, tenantId: string): boolean {
  const hit = memoryOkCache.get(cacheKey(userId, tenantId));
  if (!hit) {
    return false;
  }
  if (hit.expiresAt <= Date.now()) {
    memoryOkCache.delete(cacheKey(userId, tenantId));
    return false;
  }
  return true;
}

function writeMemoryOk(userId: string, tenantId: string): void {
  const key = cacheKey(userId, tenantId);
  memoryOkCache.set(key, { expiresAt: Date.now() + MEMORY_TTL_MS });
  if (memoryOkCache.size > 2_000) {
    const first = memoryOkCache.keys().next();
    if (!first.done) {
      memoryOkCache.delete(first.value);
    }
  }
}

/** Returns true when a recent positive grounding decision is cached (Redis or process memory). */
export async function readSessionGroundingOkCached(
  userId: string,
  tenantId: string
): Promise<boolean> {
  if (readMemoryOk(userId, tenantId)) {
    return true;
  }
  const redis = await getRedisClientForPlane("control");
  if (!redis) {
    return false;
  }
  try {
    const raw = await redis.get(cacheKey(userId, tenantId));
    if (raw === "1") {
      writeMemoryOk(userId, tenantId);
      return true;
    }
  } catch (error) {
    console.warn(
      "[session-grounding] redis read failed; mongo path",
      error instanceof Error ? error.message : String(error)
    );
  }
  return false;
}

/** Cache only successful grounding (revocation / 401 paths always re-hit Mongo). */
/** @internal Vitest only — module-level memory cache is not isolated across tests. */
export function resetSessionGroundingDecisionCacheForTests(): void {
  memoryOkCache.clear();
}

export async function writeSessionGroundingOkCached(userId: string, tenantId: string): Promise<void> {
  writeMemoryOk(userId, tenantId);
  const redis = await getRedisClientForPlane("control");
  if (!redis) {
    return;
  }
  const ttlSec = parseSessionGroundingRedisTtlSeconds();
  try {
    await redis.set(cacheKey(userId, tenantId), "1", { EX: ttlSec });
  } catch (error) {
    console.warn(
      "[session-grounding] redis write failed; memory cache only",
      error instanceof Error ? error.message : String(error)
    );
  }
}
