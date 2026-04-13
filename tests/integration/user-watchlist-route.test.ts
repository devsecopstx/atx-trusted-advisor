import type { SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const repoMocks = vi.hoisted(() => ({
  ensureUserWatchlistForSessionUser: vi.fn(),
  mutateUserWatchlistSymbols: vi.fn()
}));

const portfolioAccessMocks = vi.hoisted(() => ({
  requireTenantHexForPortfolioDataPlane: vi.fn()
}));

const lookupMocks = vi.hoisted(() => ({
  lookupSymbols: vi.fn()
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, requireSessionUser: sessionMocks.requireSessionUser };
});

vi.mock("@/lib/portfolio-access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/portfolio-access")>();
  return { ...actual, requireTenantHexForPortfolioDataPlane: portfolioAccessMocks.requireTenantHexForPortfolioDataPlane };
});

vi.mock("@/modules/core-admin/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/core-admin/repository")>();
  return {
    ...actual,
    ensureUserWatchlistForSessionUser: repoMocks.ensureUserWatchlistForSessionUser,
    mutateUserWatchlistSymbols: repoMocks.mutateUserWatchlistSymbols
  };
});

vi.mock("@/modules/watchlist/yahoo-symbol-lookup", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/watchlist/yahoo-symbol-lookup")>();
  return {
    ...actual,
    lookupSymbols: lookupMocks.lookupSymbols
  };
});

import { GET as getWatchlist, PATCH as patchWatchlist } from "@/app/api/user/watchlist/route";

function makeRequest(url: string, body?: unknown): Request {
  return new Request(url, body ? { method: "PATCH", body: JSON.stringify(body) } : undefined);
}

const baseSession = { userId: "u1", tenantId: "t1" } as const;

beforeEach(() => {
  vi.resetAllMocks();
  sessionMocks.requireSessionUser.mockResolvedValue(baseSession);
  portfolioAccessMocks.requireTenantHexForPortfolioDataPlane.mockReturnValue(null);
});

describe("user watchlist route", () => {
  it("GET returns all symbols including expired-style call legs; includes quotes when requested", async () => {
    // Arrange
    const wl = {
      _id: "w1",
      name: "My Watchlist",
      symbols: [
        { symbol: "TSLA240112C00100000", addedAt: new Date("2024-01-01T00:00:00Z") }, // past-dated call OCC shape
        { symbol: "TSLA260412P00100000", addedAt: new Date("2026-01-01T00:00:00Z") },
        { symbol: "TSLA", addedAt: new Date("2026-01-01T00:00:00Z") }
      ]
    } satisfies { _id: string; name: string; symbols: Array<{ symbol: string; addedAt: Date }> };
    repoMocks.ensureUserWatchlistForSessionUser.mockResolvedValue(wl);

    const map = new Map<string, SymbolLookupResult>();
    map.set("TSLA", { symbol: "TSLA", shortName: "Tesla" } as unknown as SymbolLookupResult);
    map.set(
      "TSLA260412P00100000",
      { symbol: "TSLA260412P00100000", contractType: "put" } as unknown as SymbolLookupResult
    );
    lookupMocks.lookupSymbols.mockResolvedValue(map);

    // Act
    const res = await getWatchlist(new Request("https://app.local/api/user/watchlist?quotes=1"));
    expect(res).toBeInstanceOf(NextResponse);
    const json = await (res as NextResponse).json();

    // Assert
    const symbols = json.data.symbols as Array<{ symbol: string }>;
    const withQuotes = json.data.symbolsWithQuotes as Array<{ symbol: string; quote: unknown }>;

    const expected = ["TSLA", "TSLA240112C00100000", "TSLA260412P00100000"].sort();
    expect(symbols.map((s) => s.symbol).sort()).toEqual(expected);
    expect(withQuotes.map((s) => s.symbol).sort()).toEqual(expected);
    const expiredRow = withQuotes.find((s) => s.symbol === "TSLA240112C00100000");
    expect(expiredRow?.quote).toBeNull();
  });

  it("PATCH removeSymbols removes an exact symbol and returns updated payload", async () => {
    // Arrange existing list
    const wl = {
      _id: "w1",
      name: "My Watchlist",
      symbols: [
        { symbol: "TSLA260412C00100000", addedAt: new Date("2026-01-01T00:00:00Z") },
        { symbol: "TSLA", addedAt: new Date("2026-01-01T00:00:00Z") }
      ]
    } satisfies { _id: string; name: string; symbols: Array<{ symbol: string; addedAt: Date }> };
    const wlAfter = {
      ...wl,
      symbols: [{ symbol: "TSLA", addedAt: new Date("2026-01-01T00:00:00Z") }]
    } satisfies { _id: string; name: string; symbols: Array<{ symbol: string; addedAt: Date }> };

    repoMocks.ensureUserWatchlistForSessionUser.mockResolvedValueOnce(wl); // for PATCH pre-ensure
    repoMocks.mutateUserWatchlistSymbols.mockResolvedValueOnce(wlAfter);

    // Act
    const req = makeRequest("https://app.local/api/user/watchlist", { removeSymbols: ["TSLA260412C00100000"] });
    const res = await patchWatchlist(req);
    const json = await (res as NextResponse).json();

    // Assert
    expect(repoMocks.mutateUserWatchlistSymbols).toHaveBeenCalledWith(
      expect.objectContaining({ removeSymbols: ["TSLA260412C00100000"] })
    );
    const symbols = json.data.symbols as Array<{ symbol: string }>;
    expect(symbols.map((s) => s.symbol)).toEqual(["TSLA"]);
  });
});
