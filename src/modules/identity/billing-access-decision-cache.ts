import type { AppUserBillingAccessState } from "@/lib/app-user-billing-state";
import { getRedisClientForPlane } from "@/lib/redis-client";
import { parseSessionGroundingRedisTtlSeconds } from "@/lib/proxy-edge-cache-ttl";

export type CachedBillingAccessDecision = {
  billingState: AppUserBillingAccessState;
  productAccessAllowed: boolean;
  requiresBilling: boolean;
  redirectPath: string;
};

const REDIS_KEY_PREFIX = "atx:billing-access:v1:";
const ttlSeconds = () => parseSessionGroundingRedisTtlSeconds();
const memoryTtlMs = () => ttlSeconds() * 1000;

const memoryCache = new Map<string, { expiresAt: number; value: CachedBillingAccessDecision }>();

function cacheKey(userId: string): string {
  return `${REDIS_KEY_PREFIX}${userId.trim()}`;
}

function readMemory(userId: string): CachedBillingAccessDecision | null {
  const hit = memoryCache.get(cacheKey(userId));
  if (!hit) {
    return null;
  }
  if (hit.expiresAt <= Date.now()) {
    memoryCache.delete(cacheKey(userId));
    return null;
  }
  return hit.value;
}

function writeMemory(userId: string, value: CachedBillingAccessDecision): void {
  memoryCache.set(cacheKey(userId), { expiresAt: Date.now() + memoryTtlMs(), value });
  if (memoryCache.size > 2_000) {
    const first = memoryCache.keys().next();
    if (!first.done) {
      memoryCache.delete(first.value);
    }
  }
}

export async function readBillingAccessDecisionCached(
  userId: string
): Promise<CachedBillingAccessDecision | null> {
  const mem = readMemory(userId);
  if (mem) {
    return mem;
  }
  const redis = await getRedisClientForPlane("control");
  if (!redis) {
    return null;
  }
  try {
    const raw = await redis.get(cacheKey(userId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CachedBillingAccessDecision;
    if (
      typeof parsed.billingState !== "string" ||
      typeof parsed.productAccessAllowed !== "boolean" ||
      typeof parsed.requiresBilling !== "boolean"
    ) {
      return null;
    }
    writeMemory(userId, parsed);
    return parsed;
  } catch (error) {
    console.warn(
      "[billing-access] redis read failed; mongo path",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

export async function writeBillingAccessDecisionCached(
  userId: string,
  value: CachedBillingAccessDecision
): Promise<void> {
  writeMemory(userId, value);
  const redis = await getRedisClientForPlane("control");
  if (!redis) {
    return;
  }
  try {
    await redis.set(cacheKey(userId), JSON.stringify(value), { EX: ttlSeconds() });
  } catch (error) {
    console.warn(
      "[billing-access] redis write failed; memory cache only",
      error instanceof Error ? error.message : String(error)
    );
  }
}
