import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireApprovedAppUserSession: vi.fn()
}));

const complianceMocks = vi.hoisted(() => ({
  resolveAdvisorComplianceStatusForSession: vi.fn(),
  upsertAdvisorComplianceAcknowledgments: vi.fn(),
  serializeAdvisorComplianceProfile: vi.fn((p: unknown) => p)
}));

vi.mock("@/lib/api-auth", () => ({
  requireApprovedAppUserSession: authMocks.requireApprovedAppUserSession
}));

vi.mock("@/lib/server-request-cache", () => ({
  getTenantByHexIdCached: vi.fn().mockResolvedValue({ name: "Example IA LLC", tenantPreferences: {} })
}));

vi.mock("@/modules/compliance/advisor-compliance-gate", () => ({
  resolveAdvisorComplianceStatusForSession: complianceMocks.resolveAdvisorComplianceStatusForSession,
  getAdvisorDisclosurePayload: () => ({
    version: "2026-05-advisor-v1",
    short: "short",
    full: "full",
    attestationText: "attest"
  })
}));

vi.mock("@/modules/compliance/repository", () => ({
  upsertAdvisorComplianceAcknowledgments: complianceMocks.upsertAdvisorComplianceAcknowledgments,
  serializeAdvisorComplianceProfile: complianceMocks.serializeAdvisorComplianceProfile,
  getAdvisorComplianceProfileForUser: vi.fn(),
  listFinraRegistrationsForAdvisor: vi.fn(),
  createFinraRegistration: vi.fn(),
  serializeFinraRegistration: vi.fn()
}));

import { PUT as putAdvisorProfile } from "@/app/api/app-user/compliance/advisor-profile/route";
import { GET as getStatus } from "@/app/api/app-user/compliance/status/route";

describe("advisor compliance API routes", () => {
  beforeEach(() => {
    authMocks.requireApprovedAppUserSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["advisor"],
      email: "advisor@test.local",
      tenantRole: "member"
    });
    complianceMocks.resolveAdvisorComplianceStatusForSession.mockResolvedValue({
      enforced: true,
      complete: false,
      redirectPath: "/account/workspace-preferences",
      missingSteps: ["finra_registration"],
      profile: null,
      finraRegistrationCount: 0,
      tenantFirmName: "Example IA LLC",
      disclosureVersion: "2026-05-advisor-v1"
    });
    complianceMocks.upsertAdvisorComplianceAcknowledgments.mockResolvedValue({
      profile: { attestationAccepted: true, updatedAt: new Date() }
    });
  });

  it("GET /compliance/status returns gate payload", async () => {
    const res = await getStatus();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { enforced: boolean; tenantFirmName: string | null };
    };
    expect(body.data.enforced).toBe(true);
    expect(body.data.tenantFirmName).toBe("Example IA LLC");
  });

  it("PUT /compliance/advisor-profile rejects non-advisor roles", async () => {
    authMocks.requireApprovedAppUserSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["operator"],
      email: "op@test.local",
      tenantRole: "member"
    });
    const res = await putAdvisorProfile(
      new Request("http://localhost/api/app-user/compliance/advisor-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      })
    );
    expect(res.status).toBe(403);
  });

  it("GET /compliance/status 401 when unauthenticated", async () => {
    authMocks.requireApprovedAppUserSession.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await getStatus();
    expect(res.status).toBe(401);
  });
});
