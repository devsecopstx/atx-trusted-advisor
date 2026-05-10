import { NextResponse } from "next/server";

import { requireGlobalAdminSession } from "@/lib/api-auth";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import { listAuditEvents } from "@/modules/audit/repository";
import { resolveTenantIdHexForGlobalAdminConsole } from "@/modules/identity/repository";

type RouteContext = {
  params: Promise<{ tenantId: string }>;
};

async function loadTenantForRoute(urlTenantId: string, sessionTenantId: string) {
  const url = urlTenantId.trim();
  let tenant = await getTenantByHexIdCached(url);
  if (tenant?._id) {
    return tenant;
  }
  if (url === sessionTenantId.trim()) {
    const resolved = await resolveTenantIdHexForGlobalAdminConsole(sessionTenantId);
    if (resolved) {
      tenant = await getTenantByHexIdCached(resolved);
    }
  }
  return tenant?._id ? tenant : null;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { tenantId } = await context.params;
  const tenant = await loadTenantForRoute(tenantId, session.tenantId);
  if (!tenant?._id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const entityHex = tenant._id.toHexString();
  const events = await listAuditEvents({
    entityType: "tenant",
    entityId: entityHex,
    action: "tenant_provision_bootstrap",
    limit: 100
  });

  return NextResponse.json({
    data: {
      tenantId: entityHex,
      events: events.map((e) => ({
        id: e._id?.toHexString() ?? "",
        createdAt: e.createdAt.toISOString(),
        actor: e.actor,
        details: e.details ?? {}
      }))
    }
  });
}
