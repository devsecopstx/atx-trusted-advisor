import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { isTenantRolePolicyPathAllowed } from "@/modules/platform/tenant-route-policy";
import { appendTenantUxObservabilityEvent } from "@/modules/platform/tenant-ux-observability-repository";
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
  const started = Date.now();
  try {
    const policy = await getCachedTenantUxPolicyForSession(session);
    const allowed = isGlobalAdmin(session.roles)
      ? true
      : isTenantRolePolicyPathAllowed(pathname, {
          allowedRoutes: policy.allowedRoutes,
          defaultLanding: policy.defaultLanding,
          flags: policy.flags
        });
    void appendTenantUxObservabilityEvent({
      type: "tenant_ux_metric",
      tenantId: session.tenantId,
      userId: session.userId,
      pathname,
      policyPath: pathname,
      metric: allowed ? "tenant_ux_route_allowed_total" : "tenant_ux_route_forbidden_total",
      ms: Date.now() - started,
      httpStatus: 200,
      ok: true
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
  } catch (error) {
    void appendTenantUxObservabilityEvent({
      type: "tenant_ux_policy_fetch_error",
      tenantId: session.tenantId,
      userId: session.userId,
      pathname,
      policyPath: pathname,
      metric: "tenant_ux_policy_unavailable_total",
      ms: Date.now() - started,
      httpStatus: 503,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      {
        error: "Tenant policy unavailable",
        code: "tenant_ux_policy_unavailable"
      },
      { status: 503 }
    );
  }
}
