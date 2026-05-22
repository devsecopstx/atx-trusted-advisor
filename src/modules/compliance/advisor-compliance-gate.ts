import { NextResponse } from "next/server";

import { getCurrentAdvisorDisclosureBundle } from "@/lib/advisor-disclosures";
import type { SessionUser } from "@/lib/auth";
import {
    buildAdvisorComplianceStatus,
    isAdvisorComplianceComplete,
    isAdvisorComplianceEnforced,
    resolveTenantFirmName
} from "@/modules/compliance/advisor-compliance";
import { buildAdvisorComplianceBlockedBody } from "@/modules/compliance/advisor-compliance-redirect";
import {
    countActiveFinraRegistrationsForAdvisor,
    getAdvisorComplianceProfileForUser
} from "@/modules/compliance/repository";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import type { Tenant } from "@/modules/identity/types";

export async function resolveAdvisorComplianceStatusForSession(input: {
  userId: string;
  tenantId: string;
  roles: string[];
  tenant: Pick<Tenant, "name" | "tenantPreferences"> | null | undefined;
}) {
  const enforced = isAdvisorComplianceEnforced({ roles: input.roles });
  const profile = enforced ? await getAdvisorComplianceProfileForUser(input.userId) : null;
  const finraRegistrationCount = enforced
    ? await countActiveFinraRegistrationsForAdvisor({
        tenantId: input.tenantId,
        advisorUserId: input.userId
      })
    : 0;

  return buildAdvisorComplianceStatus({
    enforced,
    profile,
    finraRegistrationCount,
    tenantFirmName: resolveTenantFirmName(input.tenant)
  });
}

/**
 * Returns a **403** JSON response when an app_user advisor must complete workspace compliance;
 * `null` when the request may proceed (non-advisor, global_admin, or compliance complete).
 */
export async function advisorComplianceGateResponseForAppUser(
  session: SessionUser,
  tenant: Pick<Tenant, "name" | "tenantPreferences"> | null | undefined
): Promise<NextResponse | null> {
  if (isGlobalAdmin(session.roles)) {
    return null;
  }
  const gate = await assertAdvisorComplianceForSession({
    userId: session.userId,
    tenantId: session.tenantId,
    roles: session.roles,
    tenant
  });
  if (!gate.ok) {
    return NextResponse.json(buildAdvisorComplianceBlockedBody(gate.status), { status: 403 });
  }
  return null;
}

export async function assertAdvisorComplianceForSession(input: {
  userId: string;
  tenantId: string;
  roles: string[];
  tenant: Pick<Tenant, "name" | "tenantPreferences"> | null | undefined;
}): Promise<
  | { ok: true }
  | {
      ok: false;
      code: "advisor_compliance_required";
      status: ReturnType<typeof buildAdvisorComplianceStatus>;
    }
> {
  const status = await resolveAdvisorComplianceStatusForSession(input);
  if (status.complete) {
    return { ok: true };
  }
  return {
    ok: false,
    code: "advisor_compliance_required",
    status
  };
}

export function getAdvisorDisclosurePayload() {
  const bundle = getCurrentAdvisorDisclosureBundle();
  return {
    version: bundle.version,
    short: bundle.short,
    full: bundle.full,
    attestationText: bundle.attestationText
  };
}

export { isAdvisorComplianceComplete };
