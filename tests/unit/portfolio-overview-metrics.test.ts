import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import {
    computePortfolioOverviewMetrics,
    formatUsdWhole
} from "@/lib/portfolio-overview-metrics";
import type { Account, Position } from "@/modules/core-admin/types";

const DEF_CASH = 10_000;

function basePosition(overrides: Partial<Position> & Pick<Position, "accountId" | "symbol" | "qty" | "avgCost">): Position {
  const now = new Date();
  return {
    userId: "u1",
    portfolioId: new ObjectId(),
    tenantId: undefined,
    type: "stock",
    createdAt: now,
    updatedAt: now,
    ...overrides
  } as Position;
}

describe("computePortfolioOverviewMetrics", () => {
  it("returns zeroed metrics for empty accounts and positions", () => {
    const m = computePortfolioOverviewMetrics([], [], DEF_CASH);
    expect(m.headlineBookUsd).toBe(0);
    expect(m.totalBookInclOptionsUsd).toBe(0);
    expect(m.byAccount).toEqual([]);
    expect(m.topHoldings).toEqual([]);
  });

  it("aggregates stock book, cash balance, and top holdings across one account", () => {
    const accId = new ObjectId();
    const portfolioId = new ObjectId();
    const account: Account = {
      _id: accId,
      userId: "u1",
      portfolioId,
      name: "Individual",
      type: "fidelity",
      extAccountId: "ext-1",
      cashBalance: 5000,
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const positions: Position[] = [
      basePosition({
        accountId: accId,
        symbol: "TSLA",
        qty: 10,
        avgCost: 100,
        type: "stock"
      }),
      basePosition({
        accountId: accId,
        symbol: "AAPL",
        qty: 2,
        avgCost: 200,
        type: "stock"
      })
    ];

    const m = computePortfolioOverviewMetrics(positions, [account], DEF_CASH);
    expect(m.headlineBookUsd).toBe(5000 + 1000 + 400);
    expect(m.totalBookInclOptionsUsd).toBe(m.headlineBookUsd);
    expect(m.byAccount).toHaveLength(1);
    expect(m.byAccount[0].valueExcludingOptions).toBe(6400);
    expect(m.topHoldings[0].symbol).toBe("TSLA");
    expect(m.topHoldings[0].bookValue).toBe(1000);
    expect(m.classAllocation.stocksUsd).toBe(1400);
    expect(m.classAllocation.cashUsd).toBe(5000);
  });

  it("treats cash lots separately from account cashBalance in class allocation", () => {
    const accId = new ObjectId();
    const portfolioId = new ObjectId();
    const account: Account = {
      _id: accId,
      userId: "u1",
      portfolioId,
      name: "IRA",
      type: "fidelity",
      extAccountId: "x",
      cashBalance: 100,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const positions: Position[] = [
      basePosition({
        accountId: accId,
        symbol: "USD",
        qty: 1,
        avgCost: 250,
        type: "cash"
      })
    ];
    const m = computePortfolioOverviewMetrics(positions, [account], DEF_CASH);
    expect(m.headlineBookUsd).toBe(100 + 250);
    expect(m.classAllocation.cashUsd).toBe(350);
    expect(m.classAllocation.stocksUsd).toBe(0);
  });

  it("includes option cost basis in total but keeps option legs counted", () => {
    const accId = new ObjectId();
    const portfolioId = new ObjectId();
    const account: Account = {
      _id: accId,
      userId: "u1",
      portfolioId,
      name: "Acct",
      type: "fidelity",
      extAccountId: "x",
      cashBalance: 0,
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    // 2 contracts, $1/share premium -> 2 * 100 * 1 = 200
    const positions: Position[] = [
      basePosition({
        accountId: accId,
        symbol: "TSLA",
        qty: 2,
        avgCost: 1,
        type: "option",
        optionType: "call",
        strike: 200,
        expiration: new Date("2026-06-01T00:00:00.000Z")
      })
    ];
    const m = computePortfolioOverviewMetrics(positions, [account], DEF_CASH);
    expect(m.byAccount[0].valueExcludingOptions).toBe(0);
    expect(m.byAccount[0].optionBookValue).toBe(200);
    expect(m.byAccount[0].optionLegCount).toBe(1);
    expect(m.headlineBookUsd).toBe(0);
    expect(m.totalBookInclOptionsUsd).toBe(200);
    expect(m.optionLegCount).toBe(1);
    expect(m.classAllocation.optionsUsd).toBe(200);
  });

  it("splits allocation percents across two accounts", () => {
    const a1 = new ObjectId();
    const a2 = new ObjectId();
    const portfolioId = new ObjectId();
    const accounts: Account[] = [
      {
        _id: a1,
        userId: "u1",
        portfolioId,
        name: "A",
        type: "fidelity",
        extAccountId: "1",
        cashBalance: 0,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        _id: a2,
        userId: "u1",
        portfolioId,
        name: "B",
        type: "fidelity",
        extAccountId: "2",
        cashBalance: 0,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    const positions: Position[] = [
      basePosition({ accountId: a1, symbol: "X", qty: 1, avgCost: 300, type: "stock" }),
      basePosition({ accountId: a2, symbol: "Y", qty: 1, avgCost: 100, type: "stock" })
    ];
    const m = computePortfolioOverviewMetrics(positions, accounts, DEF_CASH);
    expect(m.allocationByAccount).toHaveLength(2);
    const pctSum = m.allocationByAccount.reduce((s, x) => s + x.percent, 0);
    expect(pctSum).toBeCloseTo(100, 5);
    expect(m.allocationByAccount.find((x) => x.label === "A")?.percent).toBeCloseTo(75, 5);
  });
});

describe("formatUsdWhole", () => {
  it("formats with no fraction digits", () => {
    expect(formatUsdWhole(420240)).toMatch(/420,?240/);
  });
});
