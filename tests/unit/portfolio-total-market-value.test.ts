import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/watchlist/yahoo-symbol-lookup", () => ({
  lookupSymbols: vi.fn()
}));

import { computePortfolioTotalMarketValueUsd } from "@/lib/portfolio-total-market-value";
import type { Account, Position } from "@/modules/core-admin/types";
import { lookupSymbols } from "@/modules/watchlist/yahoo-symbol-lookup";

const LOOKUP_ROUTE = "yahoo-finance2" as const;

function stockPosition(partial: Partial<Position> & Pick<Position, "symbol" | "qty" | "avgCost" | "accountId">): Position {
  const now = new Date();
  return {
    userId: "u",
    portfolioId: new ObjectId(),
    createdAt: now,
    updatedAt: now,
    type: "stock",
    ...partial
  } as Position;
}

describe("computePortfolioTotalMarketValueUsd", () => {
  beforeEach(() => {
    vi.mocked(lookupSymbols).mockReset();
  });

  it("sums account cash plus stock market value from Yahoo quotes", async () => {
    vi.mocked(lookupSymbols).mockResolvedValue(
      new Map([["AAPL", { symbol: "AAPL", price: 200, source: LOOKUP_ROUTE }]])
    );
    const accounts = [{ cashBalance: 5000, _id: new ObjectId() }] as Account[];
    const positions = [
      stockPosition({ symbol: "AAPL", qty: 2, avgCost: 150, accountId: new ObjectId() })
    ];
    await expect(computePortfolioTotalMarketValueUsd(accounts, positions, 25_000)).resolves.toBe(5400);
  });

  it("falls back to book value per share when quote is missing", async () => {
    vi.mocked(lookupSymbols).mockResolvedValue(new Map());
    const accounts = [{ cashBalance: 0, _id: new ObjectId() }] as Account[];
    const positions = [stockPosition({ symbol: "X", qty: 4, avgCost: 25, accountId: new ObjectId() })];
    await expect(computePortfolioTotalMarketValueUsd(accounts, positions, 25_000)).resolves.toBe(100);
  });

  it("uses default cash when balance is unset", async () => {
    vi.mocked(lookupSymbols).mockResolvedValue(new Map());
    const accounts = [{ _id: new ObjectId() }] as Account[];
    await expect(computePortfolioTotalMarketValueUsd(accounts, [], 25_000)).resolves.toBe(25_000);
  });

  it("includes cash lots and option book", async () => {
    vi.mocked(lookupSymbols).mockResolvedValue(new Map());
    const accounts = [{ cashBalance: 100, _id: new ObjectId() }] as Account[];
    const aid = new ObjectId();
    const now = new Date();
    const cashLot = {
      userId: "u",
      portfolioId: new ObjectId(),
      accountId: aid,
      symbol: "USD",
      qty: 1,
      avgCost: 50,
      type: "cash" as const,
      createdAt: now,
      updatedAt: now
    } satisfies Position;
    const opt = {
      userId: "u",
      portfolioId: new ObjectId(),
      accountId: aid,
      symbol: "TSLA",
      qty: 1,
      avgCost: 2,
      type: "option" as const,
      optionType: "call" as const,
      createdAt: now,
      updatedAt: now
    } satisfies Position;
    await expect(computePortfolioTotalMarketValueUsd(accounts, [cashLot, opt], 0)).resolves.toBe(100 + 50 + 200);
  });

  it("aggregates same symbol across rows before quoting once", async () => {
    vi.mocked(lookupSymbols).mockResolvedValue(
      new Map([["ZZZ", { symbol: "ZZZ", price: 10, source: LOOKUP_ROUTE }]])
    );
    const accounts: Account[] = [];
    const aid = new ObjectId();
    const positions = [
      stockPosition({ symbol: "zzz", qty: 1, avgCost: 5, accountId: aid }),
      stockPosition({ symbol: "ZZZ", qty: 3, avgCost: 7, accountId: aid })
    ];
    await expect(computePortfolioTotalMarketValueUsd(accounts, positions, 0)).resolves.toBe(40);
    expect(lookupSymbols).toHaveBeenCalledWith(["ZZZ"]);
  });
});
