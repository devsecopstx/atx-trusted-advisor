/**
 * Per-tenant inflight cap for rental AI routes.
 * When `REDIS_URL` resolves and Redis accepts commands, uses a short-TTL counter key per tenant.
 * Otherwise falls back to an in-process map (honest for single-instance only).
 */
import { getRedisClientForPlane } from "@/lib/redis-client";

type SlotMap = Map<string, number>;

const globalSlots = globalThis as typeof globalThis & {
  __xfRentalAiInflight?: SlotMap;
};

const slots: SlotMap = globalSlots.__xfRentalAiInflight ?? new Map();
if (!globalSlots.__xfRentalAiInflight) {
  globalSlots.__xfRentalAiInflight = slots;
}

/** Lua: INCR + EXPIRE; if over max, DECR and return 0 else return 1 */
const RENTAL_AI_INFLIGHT_ACQUIRE_SCRIPT = `
local cur = redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], ARGV[2])
if cur > tonumber(ARGV[1]) then
  redis.call('DECR', KEYS[1])
  return 0
end
return 1
`;

export type RentalAiConcurrencyBackend = "redis" | "memory";

export type RentalAiConcurrencySlot = {
  backend: RentalAiConcurrencyBackend;
};

export function tryAcquireRentalAiInflightMemory(tenantIdHex: string, maxConcurrent: number): boolean {
  const key = tenantIdHex.trim();
  if (!key || maxConcurrent < 1) {
    return false;
  }
  const cur = slots.get(key) ?? 0;
  if (cur >= maxConcurrent) {
    return false;
  }
  slots.set(key, cur + 1);
  return true;
}

export function releaseRentalAiInflightMemory(tenantIdHex: string): void {
  const key = tenantIdHex.trim();
  if (!key) {
    return;
  }
  const cur = (slots.get(key) ?? 1) - 1;
  if (cur <= 0) {
    slots.delete(key);
  } else {
    slots.set(key, cur);
  }
}

async function tryAcquireRentalAiInflightRedis(
  tenantIdHex: string,
  maxConcurrent: number,
  ttlSeconds: number
): Promise<boolean | null> {
  const redis = await getRedisClientForPlane("control");
  if (!redis) {
    return null;
  }
  const key = `xf:rental-ai:inflight:${tenantIdHex.trim()}`;
  const raw = await redis.eval(RENTAL_AI_INFLIGHT_ACQUIRE_SCRIPT, {
    keys: [key],
    arguments: [String(maxConcurrent), String(ttlSeconds)]
  });
  return Number(raw) === 1;
}

async function releaseRentalAiInflightRedis(tenantIdHex: string): Promise<void> {
  const redis = await getRedisClientForPlane("control");
  if (!redis) {
    return;
  }
  const key = `xf:rental-ai:inflight:${tenantIdHex.trim()}`;
  try {
    const cur = await redis.decr(key);
    if (cur < 0) {
      await redis.del(key);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Acquire one concurrency slot. Prefer Redis when connected; on Redis errors fall back to memory.
 */
export async function acquireRentalAiConcurrencySlot(
  tenantIdHex: string,
  maxConcurrent: number
): Promise<RentalAiConcurrencySlot | null> {
  const trimmed = tenantIdHex.trim();
  if (!trimmed || maxConcurrent < 1) {
    return null;
  }

  try {
    const redisOk = await tryAcquireRentalAiInflightRedis(trimmed, maxConcurrent, 180);
    if (redisOk === true) {
      return { backend: "redis" };
    }
    if (redisOk === false) {
      return null;
    }
  } catch (err) {
    console.warn(
      "[rental-ai/concurrency] redis acquire failed; using in-process map",
      err instanceof Error ? err.message : String(err)
    );
  }

  if (tryAcquireRentalAiInflightMemory(trimmed, maxConcurrent)) {
    return { backend: "memory" };
  }
  return null;
}

export async function releaseRentalAiConcurrencySlot(
  tenantIdHex: string,
  slot: RentalAiConcurrencySlot
): Promise<void> {
  const trimmed = tenantIdHex.trim();
  if (!trimmed) {
    return;
  }
  if (slot.backend === "redis") {
    await releaseRentalAiInflightRedis(trimmed);
    return;
  }
  releaseRentalAiInflightMemory(trimmed);
}
