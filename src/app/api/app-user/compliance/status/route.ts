import { NextResponse } from "next/server";

import { requireApprovedAppUserSession } from "@/lib/api-auth";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import { advisorComplianceRequiresChatHistoryRetention } from "@/modules/compliance/advisor-compliance";
import { resolveAdvisorComplianceStatusForSession } from "@/modules/compliance/advisor-compliance-gate";
import { serializeAdvisorComplianceProfile } from "@/modules/compliance/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireApprovedAppUserSession();
  if (session instanceof NextResponse) {
    return session;
  }

  const tenant = await getTenantByHexIdCached(session.tenantId);
  const status = await resolveAdvisorComplianceStatusForSession({
    userId: session.userId,
    tenantId: session.tenantId,
    roles: session.roles,
    tenant
  });

  return NextResponse.json({
    data: {
      enforced: status.enforced,
      complete: status.complete,
      redirectPath: status.redirectPath,
      missingSteps: status.missingSteps,
      disclosureVersion: status.disclosureVersion,
      finraRegistrationCount: status.finraRegistrationCount,
      tenantFirmName: status.tenantFirmName,
      chatHistoryRetentionRequired: advisorComplianceRequiresChatHistoryRetention(status.profile),
      profile: serializeAdvisorComplianceProfile(status.profile)
    }
  });
}
