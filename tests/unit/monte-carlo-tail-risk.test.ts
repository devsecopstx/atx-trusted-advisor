import { describe, expect, it } from "vitest";

import {
    computeBookTailRiskMonteCarlo,
    mapWatchlistRiskProfileToMcTier
} from "@/modules/strategy-options/monte-carlo-tail-risk";

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("monte-carlo-tail-risk", () => {
  it("maps watchlist risk profiles to MC tiers", () => {
    expect(mapWatchlistRiskProfileToMcTier("conservative")).toBe("conservative");
    expect(mapWatchlistRiskProfileToMcTier("growth")).toBe("aggressive");
    expect(mapWatchlistRiskProfileToMcTier("balanced")).toBe("moderate");
    expect(mapWatchlistRiskProfileToMcTier(null)).toBe("moderate");
  });

  it("2020 vol-spike stress dominates base 1D VaR", async () => {
    const rand = mulberry32(99);
    const summary = await computeBookTailRiskMonteCarlo({
      tier: "moderate",
      holdings: [{ symbol: "TSLA", weight: 1 }],
      chainsByTicker: {},
      pathCount: 7000,
      rand,
      skipRedis: true
    });
    expect(summary).not.toBeNull();
    expect(summary!.stress2020VolSpike.var1dPct).toBeGreaterThanOrEqual(summary!.var1dPct95 * 1.4);
  });
});
