/**
 * Optional Redis + in-process fallback for the **full** workspace snapshot JSON (xChat / `atx_function`).
 *
 * **Key (see `buildWorkspaceSnapshotCacheKey`):** `xf:wsnap:v1:<tenant|_>:<userId>:<portfolioIdHex>:<workspaceContentRev>`
 * — same *idea* as `workspace:${portfolioId}:${rev}`, plus tenant + user for safe isolation.
 *
 * **Invalidation:** `bumpPortfolioWorkspaceContentRev` increments rev on book writes → natural cache miss (Mongo write-through; Redis is not authoritative).
 *
 * **TTL:** `REDIS_WORKSPACE_SNAPSHOT_TTL_SECONDS` (30–900s, default 60). Tune per environment.
 */
import { getRedisClient } from "@/lib/redis-client";

const MEMORY_MAX = 150;
const memory = new Map<string, { expiresAt: number; value: string }>();

function evictMemoryExpired(): void {
  const now = Date.now();
  for (const [k, v] of memory) {
    if (v.expiresAt <= now) {
      memory.delete(k);
    }
  }
}

/** TTL for workspace snapshot cache (seconds). Clamped 30–900; default 60 (hot xChat path). */
export function getWorkspaceSnapshotCacheTtlSeconds(): number {
  const raw = process.env.REDIS_WORKSPACE_SNAPSHOT_TTL_SECONDS?.trim();
  if (!raw) {
    return 60;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return 60;
  }
  return Math.min(900, Math.max(30, Math.floor(n)));
}

export function buildWorkspaceSnapshotCacheKey(input: {
  tenantId: string | undefined;
  userId: string;
  portfolioIdHex: string;
  workspaceContentRev: number;
}): string {
  const t = input.tenantId?.trim() || "_";
  return `xf:wsnap:v1:${t}:${input.userId.trim()}:${input.portfolioIdHex}:${String(input.workspaceContentRev)}`;
}

export async function readWorkspaceSnapshotCache(key: string): Promise<string | null> {
  const redis = await getRedisClient();
  if (redis) {
    try {
      const v = await redis.get(key);
      return v ?? null;
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

export async function writeWorkspaceSnapshotCache(
  key: string,
  json: string,
  ttlSeconds: number
): Promise<void> {
  const redis = await getRedisClient();
  if (redis) {
    try {
      await redis.set(key, json, { EX: ttlSeconds });
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
}
