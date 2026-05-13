import { beforeEach, describe, expect, it, vi } from "vitest";

const bffMocks = vi.hoisted(() => ({
  proxyPortfolioRequestToBackend: vi.fn<(request: Request) => Promise<Response | null>>()
}));

const authMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

vi.mock("@/lib/backend-bff", () => ({
  proxyPortfolioRequestToBackend: bffMocks.proxyPortfolioRequestToBackend
}));

vi.mock("@/lib/auth", () => authMocks);

import { POST as postAppAlert } from "@/app/api/portfolios/[portfolioId]/alerts/route";

const portfolioId = "507f1f77bcf86cd799439033";

describe("app user portfolio alerts BFF proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffMocks.proxyPortfolioRequestToBackend.mockResolvedValue(null);
    authMocks.requireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["advisor"],
      email: "user@test.local",
      tenantRole: "tenant_admin",
      xUserId: "x1",
      username: "u1"
    });
  });

  it("proxies POST …/portfolios/{id}/alerts to Spring when BFF returns a response", async () => {
    const proxied = new Response(
      JSON.stringify({
        data: {
          _id: "507f1f77bcf86cd799439099",
          title: "From JVM",
          body: null,
          severity: "info",
          status: "active",
          symbol: "TSLA",
          portfolioId,
          portfolioName: "Book",
          accountId: null,
          accountName: null,
          metadata: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }),
      { status: 201 }
    );
    bffMocks.proxyPortfolioRequestToBackend.mockResolvedValueOnce(proxied);
    const req = new Request(`http://t/api/portfolios/${portfolioId}/alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "From JVM", severity: "info", symbol: "TSLA" })
    });
    const res = await postAppAlert(req, { params: Promise.resolve({ portfolioId }) });
    expect(res.status).toBe(201);
    expect(bffMocks.proxyPortfolioRequestToBackend).toHaveBeenCalledWith(req);
    expect(authMocks.requireSessionUser).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.data.title).toBe("From JVM");
  });
});
