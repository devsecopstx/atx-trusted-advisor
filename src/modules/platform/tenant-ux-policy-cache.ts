import type { SessionUser } from "@/lib/auth";
import { getRedisClientForPlane } from "@/lib/redis-client";
import { getTenantRoutePolicyForSession, type TenantRoleFlags } from "@/modules/platform/tenant-route-policy";

export type CachedTenantUxPolicy = {
  role: string;
  tenantId: string;
  userId: string;
  allowedRoutes: string[];
  defaultLanding: string;
  flags: TenantRoleFlags;
};

const POLICY_TTL_SECONDS = 60;
const MEMORY_TTL_MS = POLICY_TTL_SECONDS * 1000;
const memoryPolicyCache = new Map<string, { expiresAt: number; value: CachedTenantUxPolicy }>();

function policyKey(userId: string, tenantId: string): string {
  return `tenant-ux:policy:v2:${userId.trim()}:${tenantId.trim()}`;
}

function tenantPolicyPattern(tenantId: string): string {
  return `tenant-ux:policy:v2:*:${tenantId.trim()}`;
}

function fromMemory(userId: string, tenantId: string): CachedTenantUxPolicy | null {
  const key = policyKey(userId, tenantId);
  const hit = memoryPolicyCache.get(key);
  if (!hit) {
    return null;
  }
  if (hit.expiresAt <= Date.now()) {
    memoryPolicyCache.delete(key);
    return null;
  }
  return hit.value;
}

function writeMemory(value: CachedTenantUxPolicy): void {
  memoryPolicyCache.set(policyKey(value.userId, value.tenantId), {
    expiresAt: Date.now() + MEMORY_TTL_MS,
    value
  });
}

export function extractCachedTenantUxPolicy(policy: Awaited<ReturnType<typeof getTenantRoutePolicyForSession>>, session: SessionUser): CachedTenantUxPolicy {
  return {
    role: policy.role,
    tenantId: session.tenantId.trim(),
    userId: session.userId.trim(),
    allowedRoutes: policy.effectiveRolePolicy.allowedRoutes,
    defaultLanding: policy.effectiveRolePolicy.defaultLanding,
    flags: policy.effectiveRolePolicy.flags
  };
}

export async function getCachedTenantUxPolicyForSession(session: SessionUser): Promise<CachedTenantUxPolicy> {
  const userId = session.userId.trim();
  const tenantId = session.tenantId.trim();
  const memory = fromMemory(userId, tenantId);
  if (memory) {
    return memory;
  }

  const key = policyKey(userId, tenantId);
  try {
    const redis = await getRedisClientForPlane("control");
    if (redis) {
      const raw = await redis.get(key);
      if (raw) {
        const parsed = JSON.parse(raw) as CachedTenantUxPolicy;
        if (parsed?.tenantId === tenantId && parsed?.userId === userId) {
          writeMemory(parsed);
          return parsed;
        }
      }
    }
  } catch (error) {
    console.warn("[tenant-ux] redis read failed; using mongo fallback", error instanceof Error ? error.message : String(error));
  }

  const resolved = await getTenantRoutePolicyForSession(session);
  const payload = extractCachedTenantUxPolicy(resolved, session);
  writeMemory(payload);

  try {
    const redis = await getRedisClientForPlane("control");
    if (redis) {
      await redis.set(key, JSON.stringify(payload), { EX: POLICY_TTL_SECONDS });
    }
  } catch (error) {
    console.warn("[tenant-ux] redis write failed; memory cache only", error instanceof Error ? error.message : String(error));
  }

  return payload;
}

async function deleteTenantPolicyKeysFromRedis(tenantId: string): Promise<number> {
  const redis = await getRedisClientForPlane("control");
  if (!redis) {
    return 0;
  }
  const pattern = tenantPolicyPattern(tenantId);
  let cursor = 0;
  let deleted = 0;
  do {
    const chunk = await redis.scan(cursor, {
      MATCH: pattern,
      COUNT: 200
    });
    cursor = chunk.cursor;
    if (chunk.keys.length > 0) {
      deleted += await redis.del(chunk.keys);
    }
  } while (cursor !== 0);
  return deleted;
}

function deleteTenantPolicyKeysFromMemory(tenantId: string): number {
  const suffix = `:${tenantId.trim()}`;
  let deleted = 0;
  for (const key of memoryPolicyCache.keys()) {
    if (!key.endsWith(suffix)) {
      continue;
    }
    memoryPolicyCache.delete(key);
    deleted += 1;
  }
  return deleted;
}

export async function bustTenantUxPolicyCacheForTenant(
  tenantId: string,
  trigger: "roles_update" | "route_catalog_patch" | "manual_bust"
): Promise<{ redisDeleted: number; memoryDeleted: number }> {
  const safeTenantId = tenantId.trim();
  const memoryDeleted = deleteTenantPolicyKeysFromMemory(safeTenantId);
  let redisDeleted = 0;
  try {
    redisDeleted = await deleteTenantPolicyKeysFromRedis(safeTenantId);
  } catch (error) {
    console.warn(
      "[tenant-ux] policy cache bust redis failed",
      error instanceof Error ? error.message : String(error)
    );
  }
  console.info(
    `[tenant-ux] explicit policy bust for tenant ${safeTenantId} on roles/catalog change`,
    JSON.stringify({ trigger, memoryDeleted, redisDeleted })
  );
  return { redisDeleted, memoryDeleted };
}

export function resetTenantUxPolicyMemoryCacheForTests(): void {
  memoryPolicyCache.clear();
}
