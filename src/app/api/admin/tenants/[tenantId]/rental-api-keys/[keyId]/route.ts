import { NextResponse } from "next/server";

import { loadTenantForAdminTenantRoute } from "@/app/api/admin/tenants/[tenantId]/admin-tenant-route-load";
import { requireGlobalAdminSession } from "@/lib/api-auth";
import { createAuditEvent } from "@/modules/audit/repository";
import { revokeTenantRentalApiKey } from "@/modules/platform/tenant-rental-api-keys";

type RouteContext = {
  params: Promise<{ tenantId: string; keyId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { tenantId, keyId } = await context.params;
  const tenant = await loadTenantForAdminTenantRoute(tenantId, session.tenantId);
  if (!tenant?._id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const revoked = await revokeTenantRentalApiKey({
    tenantId: tenant._id,
    keyId
  });

  if (!revoked.ok) {
    const status = revoked.code === "not_found" ? 404 : 400;
    return NextResponse.json({ error: revoked.message, code: revoked.code }, { status });
  }

  await createAuditEvent({
    entityType: "tenant",
    entityId: tenant._id.toHexString(),
    action: "rental_ai.api_key.revoke",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: { keyId: keyId.trim().toLowerCase() }
  }).catch(() => {});

  return NextResponse.json({ ok: true, tenantId: tenant._id.toHexString(), keyId: keyId.trim().toLowerCase() });
}
