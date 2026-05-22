import { getCurrentAdvisorDisclosureBundle } from "@/lib/advisor-disclosures";
import {
    buildAdvisorComplianceStatus,
    isAdvisorComplianceComplete,
    isAdvisorComplianceEnforced,
    resolveTenantFirmName
} from "@/modules/compliance/advisor-compliance";
import {
    countActiveFinraRegistrationsForAdvisor,
    getAdvisorComplianceProfileForUser
} from "@/modules/compliance/repository";
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
