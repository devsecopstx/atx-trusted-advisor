import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const complianceRepoMocks = vi.hoisted(() => ({
  getAdvisorComplianceProfileForUser: vi.fn(),
  countActiveFinraRegistrationsForAdvisor: vi.fn()
}));

const bffMocks = vi.hoisted(() => ({
  proxyPortfolioRequestToBackend: vi.fn()
}));

vi.mock("@/lib/auth", () => authMocks);

vi.mock("@/lib/server-request-cache", () => ({
  getTenantByHexIdCached: vi.fn().mockResolvedValue({ name: "The Fund VC", tenantPreferences: {} })
}));

vi.mock("@/lib/backend-bff", () => ({
  proxyPortfolioRequestToBackend: bffMocks.proxyPortfolioRequestToBackend,
  releaseUnusedProxyResponse: vi.fn()
}));

vi.mock("@/modules/compliance/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/compliance/repository")>();
  return {
    ...actual,
    getAdvisorComplianceProfileForUser: complianceRepoMocks.getAdvisorComplianceProfileForUser,
    countActiveFinraRegistrationsForAdvisor: complianceRepoMocks.countActiveFinraRegistrationsForAdvisor
  };
});

import { POST as postAskStream } from "@/app/api/xchat/ask/stream/route";

describe("POST /api/xchat/ask/stream advisor compliance gate", () => {
  beforeEach(() => {
    vi.stubEnv("XCHAT_SSE_PROXY_BACKEND", "1");
    vi.stubEnv("ATXFINANCE_BACKEND_ORIGIN", "http://127.0.0.1:8080");
    vi.stubEnv("NODE_ENV", "production");
    bffMocks.proxyPortfolioRequestToBackend.mockResolvedValue(
      new Response("event: ping\ndata: {}\n\n", {
        status: 200,
        headers: { "content-type": "text/event-stream" }
      })
    );
    complianceRepoMocks.getAdvisorComplianceProfileForUser.mockResolvedValue(null);
    complianceRepoMocks.countActiveFinraRegistrationsForAdvisor.mockResolvedValue(0);
    authMocks.requireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["advisor"],
      email: "advisor@thefundvc.test",
      tenantRole: "member",
      xUserId: "x1",
      username: "fundvc-advisor"
    });
  });

  it("returns 403 before BFF proxy when advisor has not completed compliance", async () => {
    const res = await postAskStream(
      new Request("http://test/api/xchat/ask/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ message: "Summarize my portfolio risk" })
      })
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("advisor_compliance_required");
    expect(bffMocks.proxyPortfolioRequestToBackend).not.toHaveBeenCalled();
  });
});
