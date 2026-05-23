import { describe, expect, it } from "vitest";

import type { SerializablePosition } from "@/app/portfolio/accounts/serializable-account";
import {
    computeHoldingsRowGreeks,
    computeHoldingsRowMetrics,
    computeIvRankPercentFromChainGlance,
    formatHoldingsGreekUsd
} from "@/app/portfolio/lib/holdings-row-metrics";

const stock: SerializablePosition = {
  _id: "1",
  type: "stock",
  symbol: "RDW",
  shares: 1000,
  purchasePrice: 10
};

const option: SerializablePosition = {
  _id: "2",
  type: "option",
  symbol: "TSLA",
  yahooRef: "",
  optionType: "call",
  strike: 400,
  expiration: "2026-06-20",
  contracts: 2,
  premiumPerContract: 12.5
};

describe("holdings-row-metrics", () => {
  it("computes stock day and total gain from live quote", () => {
    const metrics = computeHoldingsRowMetrics(stock, {
      RDW: {
        symbol: "RDW",
        source: "yahoo-finance2",
        price: 12,
        change: 0.08,
        changePercent: 0.67
      }
    });
    expect(metrics.currentValueUsd).toBe(12000);
    expect(metrics.costBasisUsd).toBe(10000);
    expect(metrics.totalGainUsd).toBe(2000);
    expect(metrics.dayGainUsd).toBeCloseTo(80);
    expect(metrics.dayGainPct).toBeCloseTo(0.67);
  });

  it("maps chain glance IV to heuristic rank like watchlist", () => {
    expect(
      computeIvRankPercentFromChainGlance({
        contractType: "call",
        strike: 400,
        impliedVolatilityPercent: 72,
        openInterest: 1200,
        optionVolume: 800,
        expirationDate: "2026-06-20"
      })
    ).toBe(74);
  });

  it("computes stock delta notional from spot", () => {
    const greeks = computeHoldingsRowGreeks(stock, { RDW: { symbol: "RDW", source: "yahoo-finance2", price: 12 } }, null);
    expect(greeks.deltaNotionalUsd).toBe(12000);
    expect(greeks.thetaDailyUsd).toBe(0);
  });

  it("computes option greeks with chain glance IV", () => {
    const greeks = computeHoldingsRowGreeks(
      option,
      { TSLA: { symbol: "TSLA", source: "yahoo-finance2", price: 420 } },
      {
        contractType: "call",
        strike: 400,
        impliedVolatilityPercent: 55,
        openInterest: 5000,
        optionVolume: 1200,
        expirationDate: "2026-06-20"
      }
    );
    expect(greeks.deltaNotionalUsd).not.toBeNull();
    expect(greeks.thetaDailyUsd).not.toBeNull();
    expect(formatHoldingsGreekUsd(greeks.deltaNotionalUsd)).toMatch(/^\+\$/);
  });
});
