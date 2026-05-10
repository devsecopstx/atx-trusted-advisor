import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { requireGlobalAdminSession } from "@/lib/api-auth";
import { createAuditEvent } from "@/modules/audit/repository";
import { bustTenantUxPolicyCacheForTenant } from "@/modules/platform/tenant-ux-policy-cache";

type RouteContext = {
  params: Promise<{ tenantId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }
  const { tenantId } = await context.params;
  if (!ObjectId.isValid(tenantId)) {
    return NextResponse.json({ error: "Invalid tenant id" }, { status: 400 });
  }
  const bust = await bustTenantUxPolicyCacheForTenant(tenantId, "manual_bust");
  await createAuditEvent({
    entityType: "tenant",
    entityId: tenantId,
    action: "tenant_ux.policy_cache_bust",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      trigger: "manual_bust",
      ...bust
    }
  });
  return NextResponse.json({
    data: {
      tenantId,
      ...bust
    }
  });
}
