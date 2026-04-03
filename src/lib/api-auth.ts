import { NextResponse } from "next/server";

import { requireSessionUser, type SessionUser } from "@/lib/auth";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";

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
