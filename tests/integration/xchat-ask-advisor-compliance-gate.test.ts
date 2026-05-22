import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const complianceRepoMocks = vi.hoisted(() => ({
  getAdvisorComplianceProfileForUser: vi.fn(),
  countActiveFinraRegistrationsForAdvisor: vi.fn()
}));

vi.mock("@/lib/auth", () => authMocks);

vi.mock("@/lib/server-request-cache", () => ({
  getTenantByHexIdCached: vi.fn().mockResolvedValue(null),
  getCoreUserByIdCached: vi.fn().mockResolvedValue({ billing: { subscriptionPlan: "basic" } }),
  getPersonaByIdCached: vi.fn(),
  loadDefaultXchatPersonaForSessionDeduped: vi.fn()
}));

vi.mock("@/lib/backend-bff", () => ({
  proxyPortfolioRequestToBackend: vi.fn().mockResolvedValue(null)
}));

vi.mock("@/modules/compliance/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/compliance/repository")>();
  return {
    ...actual,
    getAdvisorComplianceProfileForUser: complianceRepoMocks.getAdvisorComplianceProfileForUser,
    countActiveFinraRegistrationsForAdvisor: complianceRepoMocks.countActiveFinraRegistrationsForAdvisor
  };
});

import { POST as postAsk } from "@/app/api/xchat/ask/route";

describe("POST /api/xchat/ask advisor compliance gate", () => {
  beforeEach(() => {
    complianceRepoMocks.getAdvisorComplianceProfileForUser.mockResolvedValue(null);
    complianceRepoMocks.countActiveFinraRegistrationsForAdvisor.mockResolvedValue(0);
    authMocks.requireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["advisor"],
      email: "advisor@test.local",
      tenantRole: "member",
      xUserId: "x1",
      username: "advisoruser"
    });
  });

  it("returns 403 when advisor has not completed compliance even if tenant row is missing", async () => {
    const res = await postAsk(
      new Request("http://test/api/xchat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "What is my portfolio outlook?" })
      })
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string; missingSteps?: string[] };
    expect(body.code).toBe("advisor_compliance_required");
    expect(body.missingSteps).toContain("attestation");
  });
});
