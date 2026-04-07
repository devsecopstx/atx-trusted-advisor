import { NextResponse } from "next/server";

import { requireSessionUser, type SessionUser } from "@/lib/auth";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";
import { resolveTenantIdHexForGlobalAdminConsole } from "@/modules/identity/repository";

/**
 * Requires a session whose **platform roles** include `global_admin` (admin console only).
 * Tenant membership role never substitutes for this check.
 */
export async function requireGlobalAdminSession(): Promise<SessionUser | NextResponse> {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  if (!isGlobalAdmin(session.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return session;
}

/** Same as {@link requireGlobalAdminSession} — kept for existing imports. */
export async function requireAdminSession(): Promise<SessionUser | NextResponse> {
  return requireGlobalAdminSession();
}

/**
 * Tenant id for admin-console Mongo reads/writes when the session cookie still references a tenant from a prior DB.
 * @see resolveTenantIdHexForGlobalAdminConsole
 */
export async function requireAdminTenantIdHex(
  session: SessionUser
): Promise<string | NextResponse> {
  const id = await resolveTenantIdHexForGlobalAdminConsole(session.tenantId);
  if (!id) {
    return NextResponse.json(
      {
        error:
          "No tenant in this database. Run npm run seed:admin, or sign out and sign in after changing MONGODB_URI / MONGODB_DB_NAME."
      },
      { status: 404 }
    );
  }
  return id;
}

/** App-user product session: signed in with viewer+ platform role (not admin-console exclusive). */
export async function requireApprovedAppUserSession(): Promise<SessionUser | NextResponse> {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }
  if (!canUserLogin(session.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return session;
}
