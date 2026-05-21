import { describe, expect, it } from "vitest";

import type { SerializableRealEstatePosition } from "@/app/portfolio/accounts/serializable-account";
import { computeHoldingsRowMetrics, rowMarkUsd } from "@/app/portfolio/lib/holdings-row-metrics";
import { computePortfolioTotalMarketValueUsd } from "@/lib/portfolio-total-market-value";
import type { Account, Position } from "@/modules/core-admin/types";
import { realEstateNetEquityUsd } from "@/modules/core-admin/types";
import { ObjectId } from "mongodb";

describe("realEstateNetEquityUsd", () => {
  it("applies ownership percent and subtracts mortgage", () => {
    expect(
      realEstateNetEquityUsd({
        currentValueUsd: 2_850_000,
        metadata: { ownershipPct: 100, mortgageBalanceUsd: 920_000 }
      })
    ).toBe(1_930_000);
  });

  it("defaults ownership to 100% when omitted", () => {
    expect(realEstateNetEquityUsd({ currentValueUsd: 500_000, metadata: {} })).toBe(500_000);
  });
});

describe("holdings metrics for real_estate", () => {
  const row: SerializableRealEstatePosition = {
    _id: "507f1f77bcf86cd799439099",
    type: "real_estate",
    holdingName: "Lake Travis — Primary",
    currentValueUsd: 2_850_000,
    netEquityUsd: 1_930_000,
    lastValuationDate: "2026-05-18",
    valuationSource: "user_provided",
    metadata: { mortgageBalanceUsd: 920_000, ownershipPct: 100 }
  };

  it("marks net equity without quote fields", () => {
    const metrics = computeHoldingsRowMetrics(row, {});
    expect(metrics.currentValueUsd).toBe(1_930_000);
    expect(metrics.lastPrice).toBeNull();
    expect(metrics.dayGainUsd).toBeNull();
    expect(rowMarkUsd(row, {}).valueUsd).toBe(1_930_000);
  });
});

describe("computePortfolioTotalMarketValueUsd with real_estate", () => {
  it("includes net equity in portfolio total", async () => {
    const now = new Date();
    const positions = [
      {
        userId: "u",
        portfolioId: new ObjectId(),
        accountId: new ObjectId(),
        symbol: "",
        qty: 1,
        avgCost: 1_930_000,
        type: "real_estate" as const,
        currentValueUsd: 2_850_000,
        metadata: { mortgageBalanceUsd: 920_000, ownershipPct: 100 },
        createdAt: now,
        updatedAt: now
      } satisfies Position
    ];
    await expect(computePortfolioTotalMarketValueUsd([] as Account[], positions, 0)).resolves.toBe(1_930_000);
  });
});
