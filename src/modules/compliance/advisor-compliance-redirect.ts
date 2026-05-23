import type { AdvisorComplianceStatus } from "@/modules/compliance/types";

const ADVISOR_COMPLIANCE_BLOCKED_MESSAGE_ACK_ONLY =
  "Acknowledge the AI disclosure and advisor attestation, then save in Workspace preferences.";

const ADVISOR_COMPLIANCE_BLOCKED_MESSAGE_WITH_FINRA =
  "Acknowledge the AI disclosure and advisor attestation, add your FINRA registration, then save in Workspace preferences.";

/** Short ops copy when advice-like APIs block incomplete advisor compliance. */
export const ADVISOR_COMPLIANCE_BLOCKED_MESSAGE = ADVISOR_COMPLIANCE_BLOCKED_MESSAGE_WITH_FINRA;

export function buildAdvisorComplianceBlockedMessage(
  missingSteps: AdvisorComplianceStatus["missingSteps"]
): string {
  if (missingSteps.includes("finra_registration")) {
    return ADVISOR_COMPLIANCE_BLOCKED_MESSAGE_WITH_FINRA;
  }
  return ADVISOR_COMPLIANCE_BLOCKED_MESSAGE_ACK_ONLY;
}

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
  const message = buildAdvisorComplianceBlockedMessage(status.missingSteps);
  return {
    error: message,
    message,
    code: "advisor_compliance_required",
    missingSteps: status.missingSteps,
    redirectPath: status.redirectPath
  };
}

export function advisorComplianceWorkspaceRedirectPath(from: "xchat" | "quant-trader"): string {
  return `/account/workspace-preferences?compliance=required&from=${encodeURIComponent(from)}`;
}
