import { describe, expect, it } from "vitest";

import type { SerializablePosition } from "@/app/portfolio/accounts/serializable-account";
import { computeHoldingsRowMetrics } from "@/app/portfolio/lib/holdings-row-metrics";

const stock: SerializablePosition = {
  _id: "1",
  type: "stock",
  symbol: "RDW",
  shares: 1000,
  purchasePrice: 10
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
});
