import type { SessionUser } from "@/lib/auth";
import {
    getTenantRoutePolicyForSession,
    isTenantRolePolicyPathAllowed
} from "@/modules/platform/tenant-route-policy";

export async function resolveRouteGuardForSessionPath(
  session: SessionUser,
  pathname: string
): Promise<{ allowed: boolean; redirectPath: string }> {
  const policy = await getTenantRoutePolicyForSession(session);
  const allowed = isTenantRolePolicyPathAllowed(pathname, policy.effectiveRolePolicy);
  const redirectPath = policy.effectiveRolePolicy.defaultLanding;
  return { allowed, redirectPath };
}
