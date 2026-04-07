import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { requireSessionUser, type SessionUser } from "@/lib/auth";
import { parseTenantObjectId } from "@/lib/mongo-tenant-scope";

/**
 * App-user data plane: require a signed session and a valid BSON tenant id (session cookie).
 * Use on portfolio / positions / xChat history routes so invalid `tenantId` never hits permissive Mongo fallbacks.
 */
export async function requireSessionAndAppTenantObjectId(): Promise<
  { session: SessionUser; tenantOid: ObjectId } | NextResponse
> {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  const tenantOid = parseTenantObjectId(session.tenantId);
  if (!tenantOid) {
    return NextResponse.json(
      {
        error: "Tenant scope is required for this resource",
        code: "TENANT_SCOPE_REQUIRED"
      },
      { status: 403 }
    );
  }
  return { session, tenantOid };
}
