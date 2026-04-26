import type { SessionUser } from "@/lib/auth";
import {
    getTenantRoutePolicyForSession,
    isPathVisibleForRole,
    resolveDefaultLandingPathForRole
} from "@/modules/platform/tenant-route-policy";

export async function resolveRouteGuardForSessionPath(
  session: SessionUser,
  pathname: string
): Promise<{ allowed: boolean; redirectPath: string }> {
  const policy = await getTenantRoutePolicyForSession(session);
  const allowed = isPathVisibleForRole(pathname, policy.role, policy.routeOverrides);
  const redirectPath = resolveDefaultLandingPathForRole({
    role: policy.role,
    overrides: policy.routeOverrides,
    defaultLandingPathByRole: policy.defaultLandingPathByRole
  });
  return { allowed, redirectPath };
}
