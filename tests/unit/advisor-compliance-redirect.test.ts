import { describe, expect, it } from "vitest";

import {
    ADVISOR_COMPLIANCE_BLOCKED_MESSAGE,
    advisorComplianceWorkspaceRedirectPath,
    buildAdvisorComplianceBlockedBody,
    buildAdvisorComplianceBlockedMessage
} from "@/modules/compliance/advisor-compliance-redirect";

describe("advisor compliance redirect", () => {
  it("builds blocked API payload with short ops message", () => {
    const body = buildAdvisorComplianceBlockedBody({
      missingSteps: ["attestation", "finra_registration"],
      redirectPath: "/account/workspace-preferences"
    });
    expect(body.code).toBe("advisor_compliance_required");
    expect(body.message).toBe(ADVISOR_COMPLIANCE_BLOCKED_MESSAGE);
    expect(body.error).toBe(ADVISOR_COMPLIANCE_BLOCKED_MESSAGE);
    expect(body.missingSteps).toEqual(["attestation", "finra_registration"]);
  });

  it("omits FINRA from blocked message when credential-sec is off", () => {
    expect(buildAdvisorComplianceBlockedMessage(["attestation", "ai_disclosure"])).toBe(
      "Acknowledge the AI disclosure and advisor attestation, then save in Workspace preferences."
    );
  });

  it("builds workspace redirect with compliance query", () => {
    expect(advisorComplianceWorkspaceRedirectPath("xchat")).toBe(
      "/account/workspace-preferences?compliance=required&from=xchat"
    );
  });
});
