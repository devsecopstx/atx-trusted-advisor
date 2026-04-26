import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { isTenantRolePolicyPathAllowed } from "@/modules/platform/tenant-route-policy";
import { getCachedTenantUxPolicyForSession } from "@/modules/platform/tenant-ux-policy-cache";

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "") {
    return "/";
  }
  const withLeading = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (withLeading.length > 1 && withLeading.endsWith("/")) {
    return withLeading.slice(0, -1);
  }
  return withLeading;
}

export async function GET(request: Request) {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  const pathname = normalizePathname(new URL(request.url).searchParams.get("pathname") ?? "/");
  const policy = await getCachedTenantUxPolicyForSession(session);
  const allowed = isGlobalAdmin(session.roles)
    ? true
    : isTenantRolePolicyPathAllowed(pathname, {
        allowedRoutes: policy.allowedRoutes,
        defaultLanding: policy.defaultLanding,
        flags: policy.flags
      });
  return NextResponse.json({
    data: {
      allowed,
      pathname,
      role: policy.role,
      allowedRoutes: policy.allowedRoutes,
      redirectPath: policy.defaultLanding,
      flags: policy.flags
    }
  });
}
