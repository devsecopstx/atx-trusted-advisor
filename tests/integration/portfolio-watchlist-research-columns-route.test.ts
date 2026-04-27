import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const repositoryMocks = vi.hoisted(() => ({
  ensurePortfolioWatchlistForUser: vi.fn(),
  getUserWatchlistById: vi.fn(),
  listUserWatchlists: vi.fn()
}));

const lookupMocks = vi.hoisted(() => ({
  lookupSymbols: vi.fn()
}));

const optionsHotMocks = vi.hoisted(() => ({
  summarizeNearestExpiryOptionsHighlight: vi.fn()
}));

const yahooServiceMocks = vi.hoisted(() => ({
  chart: vi.fn()
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireSessionUser: sessionMocks.requireSessionUser
  };
});

vi.mock("@/lib/backend-bff", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/backend-bff")>();
  return {
    ...actual,
    proxyPortfolioRequestToBackend: vi.fn().mockResolvedValue(null)
  };
});

vi.mock("@/modules/core-admin/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/core-admin/repository")>();
  return {
    ...actual,
    ensurePortfolioWatchlistForUser: repositoryMocks.ensurePortfolioWatchlistForUser,
    getUserWatchlistById: repositoryMocks.getUserWatchlistById,
    listUserWatchlists: repositoryMocks.listUserWatchlists
  };
});

vi.mock("@/modules/watchlist/yahoo-symbol-lookup", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/watchlist/yahoo-symbol-lookup")>();
  return {
    ...actual,
    lookupSymbols: lookupMocks.lookupSymbols
  };
});

vi.mock("@/modules/find-options/options-hot-scan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/find-options/options-hot-scan")>();
  return {
    ...actual,
    summarizeNearestExpiryOptionsHighlight: optionsHotMocks.summarizeNearestExpiryOptionsHighlight
  };
});

vi.mock("@/modules/yahoo/yahoo-finance-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/yahoo/yahoo-finance-service")>();
  return {
    ...actual,
    getYahooFinance2: () => ({
      chart: yahooServiceMocks.chart
    })
  };
});

import { GET as getPortfolioWatchlist } from "@/app/api/portfolios/[portfolioId]/watchlist/route";

describe("GET /api/portfolios/:id/watchlist research columns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMocks.requireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["viewer"],
      email: "watchlist@test.local",
      tenantRole: "tenant_member",
      xUserId: "x-user-1",
      username: "wl-user"
    });
    const addedAt = new Date("2026-02-01T00:00:00.000Z");
    repositoryMocks.ensurePortfolioWatchlistForUser.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439044" },
      userId: "507f1f77bcf86cd799439011",
      tenantId: { toHexString: () => "507f1f77bcf86cd799439022" },
      portfolioId: { toHexString: () => "507f1f77bcf86cd799439033" },
      name: "Default Watchlist",
      isDefault: true,
      symbols: [{ symbol: "TSLA", addedAt }],
      createdAt: addedAt,
      updatedAt: addedAt
    });
    repositoryMocks.getUserWatchlistById.mockResolvedValue(null);
    repositoryMocks.listUserWatchlists.mockResolvedValue([
      {
        _id: { toHexString: () => "507f1f77bcf86cd799439044" },
        name: "Default Watchlist",
        isDefault: true,
        symbols: [{ symbol: "TSLA", addedAt }],
        updatedAt: addedAt
      }
    ]);
    lookupMocks.lookupSymbols.mockResolvedValue(
      new Map([
        [
          "TSLA",
          {
            symbol: "TSLA",
            companyName: "Tesla",
            price: 188.52,
            change: 1.25,
            changePercent: 0.67,
            volume: 92345678,
            fiftyTwoWeekLow: 138.8,
            fiftyTwoWeekHigh: 299.4,
            source: "yahoo-finance2"
          }
        ]
      ])
    );
    optionsHotMocks.summarizeNearestExpiryOptionsHighlight.mockResolvedValue({
      symbol: "TSLA",
      contractType: "call",
      strike: 200,
      impliedVolatilityPercent: 72.4,
      openInterest: 18340,
      optionVolume: 6120,
      expirationDate: "2026-06-19"
    });
    yahooServiceMocks.chart.mockResolvedValue({
      quotes: [
        { close: 180 },
        { close: 182 },
        { close: 181 },
        { close: 184 },
        { close: 186 },
        { close: 187 },
        { close: 188.52 }
      ]
    });
  });

  it("returns chain + technicals payload when requested", async () => {
    const response = await getPortfolioWatchlist(
      new Request(
        "http://test/api/portfolios/507f1f77bcf86cd799439033/watchlist?quotes=1&chainGlance=1&technicals=1"
      ),
      { params: Promise.resolve({ portfolioId: "507f1f77bcf86cd799439033" }) }
    );
    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: {
        symbolsWithQuotes: Array<{
          symbol: string;
          chainGlance: {
            optionVolume: number;
            expirationDate: string | null;
          } | null;
          technicals: {
            rsi14: number | null;
            sparkline7d: number[] | null;
          } | null;
        }>;
      };
    };
    const row = payload.data.symbolsWithQuotes[0];
    expect(row?.symbol).toBe("TSLA");
    expect(row?.chainGlance?.optionVolume).toBe(6120);
    expect(row?.chainGlance?.expirationDate).toBe("2026-06-19");
    expect(
      row?.technicals?.rsi14 == null || typeof row?.technicals?.rsi14 === "number"
    ).toBe(true);
    expect(Array.isArray(row?.technicals?.sparkline7d)).toBe(true);
    expect((row?.technicals?.sparkline7d ?? []).length).toBeGreaterThan(1);
  });
});
