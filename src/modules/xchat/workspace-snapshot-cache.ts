/**
 * Optional Redis + in-process fallback for serialized workspace snapshot payloads
 * (xChat system prompt). Keys include portfolio id + workspaceContentRev so Mongo bumps
 * naturally miss stale entries.
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

/** TTL for workspace snapshot cache (seconds). Clamped 30–900; default 120. */
export function getWorkspaceSnapshotCacheTtlSeconds(): number {
  const raw = process.env.REDIS_WORKSPACE_SNAPSHOT_TTL_SECONDS?.trim();
  if (!raw) {
    return 120;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return 120;
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
