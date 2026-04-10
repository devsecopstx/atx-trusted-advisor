import { NextResponse } from "next/server";

import { requireGlobalAdminSession } from "@/lib/api-auth";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import { deleteTenantIfNoMemberships, resolveTenantIdHexForGlobalAdminConsole } from "@/modules/identity/repository";

type RouteContext = {
  params: Promise<{ tenantId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireGlobalAdminSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const { tenantId: rawId } = await context.params;
  const trimmed = rawId.trim();
  let tenant = await getTenantByHexIdCached(trimmed);
  if (!tenant?._id && trimmed === session.tenantId.trim()) {
    const resolved = await resolveTenantIdHexForGlobalAdminConsole(session.tenantId);
    if (resolved) {
      tenant = await getTenantByHexIdCached(resolved);
    }
  }
  if (!tenant?._id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const effectiveHex = tenant._id.toHexString();
  const result = await deleteTenantIfNoMemberships(effectiveHex);
  if (result.ok) {
    return NextResponse.json({ data: { deleted: true, tenantId: effectiveHex } });
  }
  if (result.code === "HAS_MEMBERS") {
    return NextResponse.json(
      { error: "Tenant has users; remove all memberships before deleting the tenant." },
      { status: 409 }
    );
  }
  if (result.code === "PLATFORM_DEFAULT") {
    return NextResponse.json({ error: "Cannot delete the platform default tenant." }, { status: 400 });
  }
  return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
}
