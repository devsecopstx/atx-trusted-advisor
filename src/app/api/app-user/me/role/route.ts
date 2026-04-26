import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { getTenantRoutePolicyForSession } from "@/modules/platform/tenant-route-policy";

export async function GET() {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const policy = await getTenantRoutePolicyForSession(session);
  return NextResponse.json({
    data: {
      platformRole: policy.role,
      allowedRoutes: policy.effectiveRolePolicy.allowedRoutes,
      defaultLanding: policy.effectiveRolePolicy.defaultLanding,
      flags: policy.effectiveRolePolicy.flags,
      tenantRoleOverrides: policy.tenantRoles[policy.role] ?? null
    }
  });
}
