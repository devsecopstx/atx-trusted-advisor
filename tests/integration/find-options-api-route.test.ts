import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const bffMocks = vi.hoisted(() => ({
  proxyRequestToBackend: vi.fn<(request: Request) => Promise<Response | null>>()
}));

const serviceMocks = vi.hoisted(() => ({
  getFindOptionsContext: vi.fn(),
  getTopStockHoldingsByValue: vi.fn(),
  getHotWatchlistSymbols: vi.fn(),
  getSymbolSnapshot: vi.fn()
}));

vi.mock("@/lib/backend-bff", () => ({
  proxyRequestToBackend: bffMocks.proxyRequestToBackend
}));
vi.mock("@/lib/auth", () => ({
  requireSessionUser: authMocks.requireSessionUser
}));
vi.mock("@/modules/find-options/find-options-service", () => serviceMocks);

import { GET as getContext } from "@/app/api/app-user/find-options/context/route";
import { GET as getSnapshot } from "@/app/api/app-user/find-options/symbol-snapshot/route";

describe("GET /api/app-user/find-options/*", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffMocks.proxyRequestToBackend.mockResolvedValue(null);
    authMocks.requireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["viewer"]
    });
  });

  it("returns context payload", async () => {
    serviceMocks.getFindOptionsContext.mockResolvedValue({
      portfolio: { id: "p1", name: "Book" },
      accounts: [
        {
          id: "a1",
          name: "Primary",
          extAccountId: "Z06276930",
          isDefault: true,
          optionsApproved: false,
          riskProfile: "balanced",
          outlook: "bullish"
        }
      ],
      account: {
        id: "a1",
        name: "Primary",
        riskProfile: "balanced",
        outlook: "bullish",
        optionsApproved: false
      },
      bookOutlook: "bearish",
      bookRiskProfile: "conservative",
      scoringFactors: [
        {
          id: "iv_rank",
          weight: 0.3,
          label: "IV Rank",
          description: "d",
          normalization: "n"
        }
      ]
    });

    const res = await getContext(new Request("http://localhost/api/app-user/find-options/context"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: {
        portfolio: { name: string };
        accounts: { extAccountId: string }[];
        account: { optionsApproved: boolean };
        scoringFactors: { id: string }[];
      };
    };
    expect(json.data.portfolio.name).toBe("Book");
    expect(json.data.accounts[0]?.extAccountId).toBe("Z06276930");
    expect(json.data.account.optionsApproved).toBe(false);
    expect(json.data.scoringFactors[0]?.id).toBe("iv_rank");
    expect(serviceMocks.getFindOptionsContext).toHaveBeenCalledTimes(1);
  });

  it("validates symbol on snapshot", async () => {
    const resBad = await getSnapshot(new Request("http://localhost/api/app-user/find-options/symbol-snapshot"));
    expect(resBad.status).toBe(400);

    serviceMocks.getSymbolSnapshot.mockResolvedValue({
      symbol: "TSLA",
      lastPrice: 100,
      rsi14: 55.2,
      currency: "USD"
    });
    const resOk = await getSnapshot(
      new Request("http://localhost/api/app-user/find-options/symbol-snapshot?symbol=tsla")
    );
    expect(resOk.status).toBe(200);
    const json = (await resOk.json()) as { data: { symbol: string; rsi14: number | null } };
    expect(json.data.symbol).toBe("TSLA");
    expect(json.data.rsi14).toBe(55.2);
  });
});
