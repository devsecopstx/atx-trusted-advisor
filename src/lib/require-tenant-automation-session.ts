import { NextResponse } from "next/server";

import { requireSessionUser, type SessionUser } from "@/lib/auth";
import { parseTenantObjectId } from "@/lib/mongo-tenant-scope";
import {
    canAccessTenantUserAutomations,
    canMutateTenantUserAutomations,
    canUserLogin,
    isGlobalAdmin
} from "@/modules/identity/authorization";
import { resolveTenantIdHexForGlobalAdminConsole } from "@/modules/identity/repository";

export type TenantAutomationSessionOk = {
  ok: true;
  session: SessionUser;
  tenantIdHex: string;
};

export type TenantAutomationSessionResult = TenantAutomationSessionOk | { ok: false; response: NextResponse };

/**
 * Workspace tenant automations: viewer blocked; advisor read-only vs operator/global_admin mutate.
 */
export async function requireTenantAutomationSession(mode: "read" | "write"): Promise<TenantAutomationSessionResult> {
  const session = await requireSessionUser();
  if (session instanceof NextResponse) {
    return { ok: false, response: session };
  }
  if (!canUserLogin(session.roles)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    };
  }
  if (mode === "read") {
    if (!canAccessTenantUserAutomations(session.roles)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Forbidden", code: "tenant_automations_forbidden" },
          { status: 403 }
        )
      };
    }
  } else if (!canMutateTenantUserAutomations(session.roles)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden", code: "tenant_automations_mutations_forbidden" },
        { status: 403 }
      )
    };
  }

  if (isGlobalAdmin(session.roles)) {
    const tenantIdHex = await resolveTenantIdHexForGlobalAdminConsole(session.tenantId);
    if (!tenantIdHex) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error:
              "No tenant in this database. Run npm run seed:admin, or sign out and sign in after changing Mongo.",
            code: "TENANT_REQUIRED"
          },
          { status: 404 }
        )
      };
    }
    return { ok: true, session, tenantIdHex };
  }

  const tenantOid = parseTenantObjectId(session.tenantId);
  if (!tenantOid) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Tenant scope is required for this resource", code: "TENANT_SCOPE_REQUIRED" },
        { status: 403 }
      )
    };
  }

  return { ok: true, session, tenantIdHex: tenantOid.toHexString() };
}
