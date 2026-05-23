import { getCurrentAdvisorDisclosureBundle } from "@/lib/advisor-disclosures";
import { countAdvisorAdviceEventsForAdvisor } from "@/modules/compliance/advisor-advice-events";
import { resolveAdvisorComplianceStatusForSession } from "@/modules/compliance/advisor-compliance-gate";
import {
    listFinraRegistrationsForAdvisor,
    serializeAdvisorComplianceProfile,
    serializeFinraRegistration
} from "@/modules/compliance/repository";
import { isAdvisorPlatformRole } from "@/modules/identity/authorization";
import type { Tenant } from "@/modules/identity/types";
import {
    optionsStrategyEngineConfigPayloadForApi
} from "@/modules/strategy-options/tenant-options-strategy-engine-config";

export type AdvisorComplianceReportExport = {
  exportedAt: string;
  reportVersion: "2026-05-advisor-compliance-v1";
  user: {
    userId: string;
    email: string;
    roles: string[];
  };
  tenant: {
    tenantId: string;
    firmName: string | null;
    slug: string | null;
  };
  compliance: {
    enforced: boolean;
    complete: boolean;
    missingSteps: string[];
    disclosureVersion: string;
    chatHistoryRetentionRequired: boolean;
    profile: ReturnType<typeof serializeAdvisorComplianceProfile>;
  };
  finraRegistrations: ReturnType<typeof serializeFinraRegistration>[];
  adviceEventCount: number;
  disclosure: {
    version: string;
    short: string;
    attestationText: string;
  };
  optionsStrategyEngine: ReturnType<typeof optionsStrategyEngineConfigPayloadForApi>;
};

export async function buildAdvisorComplianceReportExport(input: {
  userId: string;
  tenantId: string;
  email: string;
  roles: string[];
  tenant: Pick<Tenant, "name" | "slug" | "tenantPreferences"> | null | undefined;
}): Promise<AdvisorComplianceReportExport | { error: "forbidden" }> {
  if (!isAdvisorPlatformRole(input.roles)) {
    return { error: "forbidden" };
  }

  const status = await resolveAdvisorComplianceStatusForSession({
    userId: input.userId,
    tenantId: input.tenantId,
    roles: input.roles,
    tenant: input.tenant
  });
  const registrations = await listFinraRegistrationsForAdvisor({
    tenantId: input.tenantId,
    advisorUserId: input.userId,
    limit: 100
  });
  const adviceEventCount = await countAdvisorAdviceEventsForAdvisor({
    tenantId: input.tenantId,
    advisorUserId: input.userId
  });
  const bundle = getCurrentAdvisorDisclosureBundle();

  return {
    exportedAt: new Date().toISOString(),
    reportVersion: "2026-05-advisor-compliance-v1",
    user: {
      userId: input.userId,
      email: input.email,
      roles: input.roles
    },
    tenant: {
      tenantId: input.tenantId,
      firmName: status.tenantFirmName,
      slug: input.tenant?.slug ?? null
    },
    compliance: {
      enforced: status.enforced,
      complete: status.complete,
      missingSteps: status.missingSteps,
      disclosureVersion: status.disclosureVersion,
      chatHistoryRetentionRequired: status.profile?.attestationAccepted === true,
      profile: serializeAdvisorComplianceProfile(status.profile)
    },
    finraRegistrations: registrations.map(serializeFinraRegistration),
    adviceEventCount,
    disclosure: {
      version: bundle.version,
      short: bundle.short,
      attestationText: bundle.attestationText
    },
    optionsStrategyEngine: optionsStrategyEngineConfigPayloadForApi(input.tenant)
  };
}
