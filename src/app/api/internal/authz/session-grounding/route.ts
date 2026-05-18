import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth";
import { isCoreUserAccountAccessApproved } from "@/modules/identity/account-status";
import { getCoreUserByIdCached } from "@/lib/server-request-cache";
import { resolveTenantMembershipForSessionGrounding } from "@/modules/identity/repository";

/**
 * Validates that the signed session still matches Mongo: active user, approved access gate,
 * and a real `core_tenant_memberships` row for `session.tenantId`.
 * Used by `src/proxy.ts` edge enforcement (fail-closed when unreachable).
 */
export async function GET() {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return session;
  }

  if (!ObjectId.isValid(session.userId) || !ObjectId.isValid(session.tenantId)) {
    return NextResponse.json(
      { ok: false as const, code: "invalid_session" },
      { status: 401 }
    );
  }

  const userId = new ObjectId(session.userId);
  const user = await getCoreUserByIdCached(session.userId);

  if (!user?._id || user.status === "suspended") {
    return NextResponse.json({ ok: false as const, code: "user_ineligible" }, { status: 401 });
  }

  if (!isCoreUserAccountAccessApproved(user)) {
    return NextResponse.json(
      { ok: false as const, code: "account_not_approved" },
      { status: 401 }
    );
  }

  const membership = await resolveTenantMembershipForSessionGrounding(userId, session.tenantId);
  if (!membership?._id) {
    return NextResponse.json(
      { ok: false as const, code: "no_tenant_membership" },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true as const });
}
