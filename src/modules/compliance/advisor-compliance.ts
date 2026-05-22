import {
    ADVISOR_AI_DISCLOSURE_VERSION,
    getCurrentAdvisorDisclosureBundle
} from "@/lib/advisor-disclosures";
import { isAdvisorPlatformRole, isGlobalAdmin } from "@/modules/identity/authorization";
import type { Tenant } from "@/modules/identity/types";

import type {
    AdvisorComplianceMissingStep,
    AdvisorComplianceProfile,
    AdvisorComplianceStatus
} from "@/modules/compliance/types";

export const ADVISOR_COMPLIANCE_REDIRECT_PATH = "/account/workspace-preferences";

export { isAdvisorPlatformRole } from "@/modules/identity/authorization";

/** Advisor-role users must complete workspace preferences before advice-like APIs. Operators/viewers skip. */
export function isAdvisorComplianceEnforced(input: {
  roles: string[];
}): boolean {
  if (isGlobalAdmin(input.roles)) {
    return false;
  }
  return isAdvisorPlatformRole(input.roles);
}

export function resolveTenantFirmName(tenant: Pick<Tenant, "name"> | null | undefined): string | null {
  const name = tenant?.name?.trim();
  return name && name.length > 0 ? name : null;
}

export function normalizeAdvisorComplianceProfile(
  raw: Partial<AdvisorComplianceProfile> | null | undefined,
  now = new Date()
): AdvisorComplianceProfile | null {
  if (!raw) {
    return null;
  }
  const complianceContactEmail =
    typeof raw.complianceContactEmail === "string" && raw.complianceContactEmail.trim().length > 0
      ? raw.complianceContactEmail.trim()
      : undefined;

  return {
    complianceContactEmail,
    attestationAccepted: raw.attestationAccepted === true,
    attestationAcceptedAt:
      raw.attestationAccepted === true ? raw.attestationAcceptedAt ?? now : raw.attestationAcceptedAt,
    aiDisclosureVersionAccepted: raw.aiDisclosureVersionAccepted,
    aiDisclosureAcceptedAt: raw.aiDisclosureAcceptedAt,
    updatedAt: raw.updatedAt ?? now
  };
}

export function listAdvisorComplianceMissingSteps(input: {
  profile: AdvisorComplianceProfile | null;
  finraRegistrationCount: number;
}): AdvisorComplianceMissingStep[] {
  const missing: AdvisorComplianceMissingStep[] = [];
  const profile = input.profile;
  const bundle = getCurrentAdvisorDisclosureBundle();

  if (!profile?.attestationAccepted) {
    missing.push("attestation");
  }
  if (
    profile?.aiDisclosureVersionAccepted !== bundle.version ||
    !profile?.aiDisclosureAcceptedAt
  ) {
    missing.push("ai_disclosure");
  }
  if (input.finraRegistrationCount < 1) {
    missing.push("finra_registration");
  }
  return missing;
}

export function isAdvisorComplianceComplete(input: {
  profile: AdvisorComplianceProfile | null;
  finraRegistrationCount: number;
}): boolean {
  return listAdvisorComplianceMissingSteps(input).length === 0;
}

export function buildAdvisorComplianceStatus(input: {
  enforced: boolean;
  profile: AdvisorComplianceProfile | null;
  finraRegistrationCount: number;
  tenantFirmName: string | null;
}): AdvisorComplianceStatus {
  const missingSteps = input.enforced
    ? listAdvisorComplianceMissingSteps({
        profile: input.profile,
        finraRegistrationCount: input.finraRegistrationCount
      })
    : [];
  return {
    enforced: input.enforced,
    complete: !input.enforced || missingSteps.length === 0,
    redirectPath: ADVISOR_COMPLIANCE_REDIRECT_PATH,
    missingSteps,
    profile: input.profile,
    finraRegistrationCount: input.finraRegistrationCount,
    tenantFirmName: input.tenantFirmName,
    disclosureVersion: ADVISOR_AI_DISCLOSURE_VERSION
  };
}

export function parseAdvisorComplianceProfileFromUserDoc(
  raw: unknown
): AdvisorComplianceProfile | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  return normalizeAdvisorComplianceProfile(raw as Partial<AdvisorComplianceProfile>);
}

/** Advisor compliance attestation requires Mongo chat retention for audit/export. */
export function advisorComplianceRequiresChatHistoryRetention(
  profile: AdvisorComplianceProfile | null | undefined
): boolean {
  return profile?.attestationAccepted === true;
}
