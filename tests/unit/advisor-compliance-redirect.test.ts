import { describe, expect, it } from "vitest";

import {
    ADVISOR_COMPLIANCE_BLOCKED_MESSAGE,
    advisorComplianceWorkspaceRedirectPath,
    buildAdvisorComplianceBlockedBody
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

  it("builds workspace redirect with compliance query", () => {
    expect(advisorComplianceWorkspaceRedirectPath("xchat")).toBe(
      "/account/workspace-preferences?compliance=required&from=xchat"
    );
  });
});
