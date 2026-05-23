import { describe, expect, it } from "vitest";

import { ADVISOR_AI_DISCLOSURE_VERSION } from "@/lib/advisor-disclosures";
import {
    advisorComplianceRequiresChatHistoryRetention,
    buildAdvisorComplianceStatus,
    isAdvisorComplianceComplete,
    isAdvisorComplianceEnforced,
    listAdvisorComplianceMissingSteps,
    normalizeAdvisorComplianceProfile,
    resolveTenantFirmName
} from "@/modules/compliance/advisor-compliance";

describe("advisor compliance", () => {
  it("enforces only for advisor role (not operator/viewer)", () => {
    expect(isAdvisorComplianceEnforced({ roles: ["advisor"] })).toBe(true);
    expect(isAdvisorComplianceEnforced({ roles: ["operator"] })).toBe(false);
    expect(isAdvisorComplianceEnforced({ roles: ["viewer"] })).toBe(false);
  });

  it("skips enforcement for global_admin", () => {
    expect(isAdvisorComplianceEnforced({ roles: ["global_admin", "advisor"] })).toBe(false);
  });

  it("uses tenant name as IA firm", () => {
    expect(resolveTenantFirmName({ name: "  Example IA LLC  " })).toBe("Example IA LLC");
  });

  it("lists missing steps until acks + finra registration when credential-sec is on", () => {
    const incomplete = normalizeAdvisorComplianceProfile({
      attestationAccepted: false,
      updatedAt: new Date()
    });
    expect(
      listAdvisorComplianceMissingSteps({
        profile: incomplete,
        finraRegistrationCount: 0,
        credentialSecEnabled: true
      })
    ).toEqual(["attestation", "ai_disclosure", "finra_registration"]);

    const complete = normalizeAdvisorComplianceProfile({
      attestationAccepted: true,
      attestationAcceptedAt: new Date(),
      aiDisclosureVersionAccepted: ADVISOR_AI_DISCLOSURE_VERSION,
      aiDisclosureAcceptedAt: new Date(),
      updatedAt: new Date()
    });
    expect(complete).not.toBeNull();
    expect(
      isAdvisorComplianceComplete({ profile: complete, finraRegistrationCount: 1, credentialSecEnabled: true })
    ).toBe(true);
    expect(complete!.complianceCompletedAt).toBeUndefined();
  });

  it("skips finra_registration when credential-sec is off (default)", () => {
    const complete = normalizeAdvisorComplianceProfile({
      attestationAccepted: true,
      attestationAcceptedAt: new Date(),
      aiDisclosureVersionAccepted: ADVISOR_AI_DISCLOSURE_VERSION,
      aiDisclosureAcceptedAt: new Date(),
      updatedAt: new Date()
    });
    expect(
      listAdvisorComplianceMissingSteps({
        profile: complete,
        finraRegistrationCount: 0,
        credentialSecEnabled: false
      })
    ).toEqual([]);
    expect(
      isAdvisorComplianceComplete({ profile: complete, finraRegistrationCount: 0, credentialSecEnabled: false })
    ).toBe(true);
  });

  it("preserves complianceCompletedAt on profile normalization", () => {
    const completedAt = new Date("2026-05-20T12:00:00.000Z");
    const profile = normalizeAdvisorComplianceProfile({
      attestationAccepted: true,
      attestationAcceptedAt: completedAt,
      aiDisclosureVersionAccepted: ADVISOR_AI_DISCLOSURE_VERSION,
      aiDisclosureAcceptedAt: completedAt,
      complianceCompletedAt: completedAt,
      updatedAt: completedAt
    });
    expect(profile?.complianceCompletedAt).toEqual(completedAt);
  });

  it("builds status with workspace preferences redirect", () => {
    const status = buildAdvisorComplianceStatus({
      enforced: true,
      profile: null,
      finraRegistrationCount: 0,
      tenantFirmName: "Demo IA"
    });
    expect(status.complete).toBe(false);
    expect(status.redirectPath).toBe("/account/workspace-preferences");
    expect(status.tenantFirmName).toBe("Demo IA");
  });

  it("requires chat history retention after compliance attestation", () => {
    expect(advisorComplianceRequiresChatHistoryRetention(null)).toBe(false);
    expect(
      advisorComplianceRequiresChatHistoryRetention(
        normalizeAdvisorComplianceProfile({ attestationAccepted: false, updatedAt: new Date() })
      )
    ).toBe(false);
    expect(
      advisorComplianceRequiresChatHistoryRetention(
        normalizeAdvisorComplianceProfile({ attestationAccepted: true, updatedAt: new Date() })
      )
    ).toBe(true);
  });
});
