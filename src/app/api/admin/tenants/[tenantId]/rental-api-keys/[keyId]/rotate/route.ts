import { NextResponse } from "next/server";

import { loadTenantForAdminTenantRoute } from "@/app/api/admin/tenants/[tenantId]/admin-tenant-route-load";
import { requireGlobalAdminSession } from "@/lib/api-auth";
import { createAuditEvent } from "@/modules/audit/repository";
import { rotateTenantRentalApiKey } from "@/modules/platform/tenant-rental-api-keys";

type RouteContext = {
  params: Promise<{ tenantId: string; keyId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { tenantId, keyId } = await context.params;
  const tenant = await loadTenantForAdminTenantRoute(tenantId, session.tenantId);
  if (!tenant?._id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const rotated = await rotateTenantRentalApiKey({
    tenantId: tenant._id,
    keyId
  });

  if (!rotated.ok) {
    const status =
      rotated.code === "tenant_not_found"
        ? 404
        : rotated.code === "not_found"
          ? 404
          : rotated.code === "already_revoked"
            ? 409
            : rotated.code === "rental_profile_missing" ||
                rotated.code === "api_keys_disabled" ||
                rotated.code === "rental_expired"
              ? 409
              : 400;
    return NextResponse.json({ error: rotated.message, code: rotated.code }, { status });
  }

  await createAuditEvent({
    entityType: "tenant",
    entityId: tenant._id.toHexString(),
    action: "rental_ai.api_key.rotate",
    actor: {
      userId: session.userId,
      email: session.email,
      username: session.username
    },
    details: {
      revokedKeyId: rotated.revokedKeyId,
      newKeyId: rotated.listed.id
    }
  }).catch(() => {});

  return NextResponse.json({
    tenantId: tenant._id.toHexString(),
    plaintextKey: rotated.plaintextKey,
    key: rotated.listed,
    revokedKeyId: rotated.revokedKeyId,
    warning: "Store plaintextKey now; it cannot be retrieved later."
  });
}
