import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const bookMocks = vi.hoisted(() => ({
  loadAppUserDefaultBook: vi.fn()
}));

const mcMocks = vi.hoisted(() => ({
  runMonteCarloTailRiskTool: vi.fn()
}));

const bootstrapMocks = vi.hoisted(() => ({
  getFindOptionsBootstrap: vi.fn(),
  listPortfoliosForSessionUser: vi.fn()
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/app-user-default-book", () => bookMocks);
vi.mock("@/modules/xchat/monte-carlo-tail-risk-tool", () => mcMocks);
vi.mock("@/modules/find-options/find-options-service", () => ({
  getFindOptionsBootstrap: bootstrapMocks.getFindOptionsBootstrap
}));
vi.mock("@/modules/core-admin/repository", () => ({
  listPortfoliosForSessionUser: bootstrapMocks.listPortfoliosForSessionUser
}));
vi.mock("@/lib/distributed-rate-limit", () => ({
  checkDistributedRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 5,
    resetAtMs: Date.now() + 60_000,
    retryAfterSeconds: 0,
    source: "memory" as const
  })),
  buildRateLimitHeaders: () => ({}),
  extractClientRateLimitKey: () => "test"
}));

import { GET as getContext } from "@/app/api/app-user/xoptions/quant-trader/context/route";
import { POST as postRun } from "@/app/api/app-user/xoptions/quant-trader/run/route";

const session = {
  userId: "u1",
  tenantId: "t1",
  email: "desk@example.com",
  roles: ["advisor"]
};

describe("xOptions quant-trader API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireSessionUser.mockResolvedValue(session);
    bookMocks.loadAppUserDefaultBook.mockResolvedValue({
      portfolioId: "507f1f77bcf86cd799439011",
      portfolioName: "Default Portfolio",
      accountId: null
    });
    bootstrapMocks.listPortfoliosForSessionUser.mockResolvedValue([{}, {}, {}]);
    bootstrapMocks.getFindOptionsBootstrap.mockResolvedValue({
      context: {
        account: { riskProfile: "growth", outlook: "bullish" },
        bookRiskProfile: "growth",
        bookOutlook: "bullish"
      },
      hot: { rows: [{ symbol: "TSLA" }, { symbol: "RKLB" }], scanned: 2 }
    });
  });

  it("GET context returns workspace defaults for quant desk", async () => {
    const res = await getContext(new Request("http://localhost/api/app-user/xoptions/quant-trader/context"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { ownedPortfolioCount: number; defaultParams: { minIvRankPct: number } } };
    expect(json.data.ownedPortfolioCount).toBe(3);
    expect(json.data.defaultParams.minIvRankPct).toBe(60);
  });

  it("POST run delegates to monte_carlo_tail_risk with multi-portfolio scope", async () => {
    mcMocks.runMonteCarloTailRiskTool.mockResolvedValue({
      ok: true,
      generatedAt: new Date().toISOString(),
      risk: "aggressive",
      horizonDays: 45,
      minIvRankPct: 60,
      portfolios: [],
      combinedTailRisk: null,
      strategyJobHandoff: { path: "/xoptions", instruction: "test" },
      disclaimer: "Not advice."
    });

    const res = await postRun(
      new Request("http://localhost/api/app-user/xoptions/quant-trader/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          horizonDays: 45,
          minIvRankPct: 60,
          maxDrawdownPct: 15,
          portfolioScope: "all",
          perPortfolioRisk: true
        })
      })
    );
    expect(res.status).toBe(200);
    expect(mcMocks.runMonteCarloTailRiskTool).toHaveBeenCalledWith(
      expect.objectContaining({
        portfolioScope: "all",
        horizonDays: 45,
        minIvRankPct: 60,
        maxDrawdownPct: 15,
        perPortfolioRisk: true
      }),
      expect.objectContaining({ userId: "u1", workspacePortfolioId: "507f1f77bcf86cd799439011" })
    );
  });

  it("POST run returns 401 when unauthenticated", async () => {
    authMocks.requireSessionUser.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await postRun(
      new Request("http://localhost/api/app-user/xoptions/quant-trader/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      })
    );
    expect(res.status).toBe(401);
  });
});
