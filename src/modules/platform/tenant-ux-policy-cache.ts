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

export function resetTenantUxPolicyMemoryCacheForTests(): void {
  memoryPolicyCache.clear();
}
