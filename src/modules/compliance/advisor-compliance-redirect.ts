import type { AdvisorComplianceStatus } from "@/modules/compliance/types";

/** Short ops copy when advice-like APIs block incomplete advisor compliance. */
export const ADVISOR_COMPLIANCE_BLOCKED_MESSAGE =
  "Acknowledge the AI disclosure and advisor attestation, add your FINRA registration, then save in Workspace preferences.";

export type AdvisorComplianceBlockedBody = {
  error: string;
  message: string;
  code: "advisor_compliance_required";
  missingSteps: AdvisorComplianceStatus["missingSteps"];
  redirectPath: string;
};

export function buildAdvisorComplianceBlockedBody(
  status: Pick<AdvisorComplianceStatus, "missingSteps" | "redirectPath">
): AdvisorComplianceBlockedBody {
  return {
    error: ADVISOR_COMPLIANCE_BLOCKED_MESSAGE,
    message: ADVISOR_COMPLIANCE_BLOCKED_MESSAGE,
    code: "advisor_compliance_required",
    missingSteps: status.missingSteps,
    redirectPath: status.redirectPath
  };
}

export function advisorComplianceWorkspaceRedirectPath(from: "xchat" | "quant-trader"): string {
  return `/account/workspace-preferences?compliance=required&from=${encodeURIComponent(from)}`;
}
