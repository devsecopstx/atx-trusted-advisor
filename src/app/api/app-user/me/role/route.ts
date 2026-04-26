import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { getCachedTenantUxPolicyForSession } from "@/modules/platform/tenant-ux-policy-cache";

export async function GET() {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const policy = await getCachedTenantUxPolicyForSession(session);
  return NextResponse.json({
    data: {
      platformRole: policy.role,
      allowedRoutes: policy.allowedRoutes,
      defaultLanding: policy.defaultLanding,
      flags: policy.flags,
      tenantRoleOverrides: null
    }
  });
}
