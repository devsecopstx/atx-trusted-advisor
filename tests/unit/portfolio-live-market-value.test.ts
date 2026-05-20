import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPortfolioLiveMarketValueUsdForSessionUser } from "@/lib/portfolio-live-market-value";
import type { Account, Position } from "@/modules/core-admin/types";
import type { SymbolLookupResult } from "@/modules/watchlist/yahoo-symbol-lookup";

const repositoryMocks = vi.hoisted(() => ({
  listPortfolioAccounts: vi.fn(),
  listPortfolioPositionsByAccount: vi.fn()
}));

const lookupMocks = vi.hoisted(() => ({
  lookupSymbols: vi.fn()
}));

vi.mock("@/modules/core-admin/repository", async () => {
  const actual = await vi.importActual<typeof import("@/modules/core-admin/repository")>(
    "@/modules/core-admin/repository"
  );
  return {
    ...actual,
    listPortfolioAccounts: repositoryMocks.listPortfolioAccounts,
    listPortfolioPositionsByAccount: repositoryMocks.listPortfolioPositionsByAccount
  };
});

vi.mock("@/modules/watchlist/yahoo-symbol-lookup", () => ({
  lookupSymbols: lookupMocks.lookupSymbols
}));

function q(partial: Partial<SymbolLookupResult> & Pick<SymbolLookupResult, "symbol">): SymbolLookupResult {
  return { source: "yahoo-finance2", ...partial };
}

describe("getPortfolioLiveMarketValueUsdForSessionUser", () => {
  const userId = "user-1";
  const tenantId = "tenant-1";
  const portfolioId = new ObjectId().toHexString();
  const accountId = new ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sums cash balances, cash lots, and stock at last price", async () => {
    const accounts: Array<Account & { _id: ObjectId }> = [
      { _id: accountId, cashBalance: 10_000, name: "Main" } as Account & { _id: ObjectId }
    ];
    const positions: Position[] = [
      { _id: new ObjectId(), type: "cash", symbol: "USD", qty: 1, avgCost: 500 },
      { _id: new ObjectId(), type: "stock", symbol: "AAPL", qty: 10, avgCost: 100 }
    ] as Position[];

    repositoryMocks.listPortfolioAccounts.mockResolvedValue(accounts);
    repositoryMocks.listPortfolioPositionsByAccount.mockResolvedValue(positions);
    lookupMocks.lookupSymbols.mockResolvedValue(
      new Map([["AAPL", q({ symbol: "AAPL", price: 120 })]])
    );

    const total = await getPortfolioLiveMarketValueUsdForSessionUser({
      userId,
      tenantId,
      portfolioId
    });

    // 10_000 cash + 500 cash lot + 10 * 120 stock
    expect(total).toBe(11_700);
    expect(lookupMocks.lookupSymbols).toHaveBeenCalledWith(["AAPL"], { allowNetwork: true });
  });

  it("falls back to book value when a stock quote is missing", async () => {
    const accounts: Array<Account & { _id: ObjectId }> = [
      { _id: accountId, cashBalance: 0, name: "Main" } as Account & { _id: ObjectId }
    ];
    const positions: Position[] = [
      { _id: new ObjectId(), type: "stock", symbol: "ZZZZ", qty: 2, avgCost: 50 }
    ] as Position[];

    repositoryMocks.listPortfolioAccounts.mockResolvedValue(accounts);
    repositoryMocks.listPortfolioPositionsByAccount.mockResolvedValue(positions);
    lookupMocks.lookupSymbols.mockResolvedValue(new Map([["ZZZZ", q({ symbol: "ZZZZ" })]]));

    const total = await getPortfolioLiveMarketValueUsdForSessionUser({
      userId,
      portfolioId
    });

    expect(total).toBe(100);
    expect(lookupMocks.lookupSymbols).toHaveBeenCalledWith(["ZZZZ"], { allowNetwork: true });
  });

  it("ignores options and skips quotes when there are no stock symbols", async () => {
    const accounts: Array<Account & { _id: ObjectId }> = [
      { _id: accountId, cashBalance: 1_000, name: "Main" } as Account & { _id: ObjectId }
    ];
    const positions: Position[] = [
      {
        _id: new ObjectId(),
        type: "option",
        symbol: "TSLA",
        qty: 1,
        avgCost: 5,
        optionType: "call",
        strike: 200,
        expiration: new Date("2026-12-18")
      }
    ] as Position[];

    repositoryMocks.listPortfolioAccounts.mockResolvedValue(accounts);
    repositoryMocks.listPortfolioPositionsByAccount.mockResolvedValue(positions);

    const total = await getPortfolioLiveMarketValueUsdForSessionUser({
      userId,
      portfolioId
    });

    expect(total).toBe(1_000);
    expect(lookupMocks.lookupSymbols).not.toHaveBeenCalled();
  });
});
