import { describe, expect, it } from "vitest";

import {
    applyIVRankFilter,
    estimateIvRankPercentFromAtmIv,
    OPTIONS_SCANNER_DEFAULT_MIN_IV_RANK_PCT,
    resolveScannerIvRankFloor
} from "@/modules/strategy-options/iv-rank-filter";
import {
    STRADDLE_DELTA_RANGE,
    straddleDeltaDistanceScore,
    straddleDeltaInRange
} from "@/modules/strategy-options/strategy-options-engine";

describe("iv-rank-filter", () => {
  it("defaults scanner floor to 45%", () => {
    expect(OPTIONS_SCANNER_DEFAULT_MIN_IV_RANK_PCT).toBe(45);
    expect(resolveScannerIvRankFloor([])).toBe(45);
  });

  it("merges strategy filter floors as max", () => {
    expect(
      resolveScannerIvRankFloor([
        { filters: { minIvRankPct: 40 } },
        { filters: { minIvRankPct: 55 } }
      ])
    ).toBe(55);
  });

  it("passes when iv rank meets floor", () => {
    const ivRank = estimateIvRankPercentFromAtmIv(0.42);
    expect(ivRank).not.toBeNull();
    expect(applyIVRankFilter(ivRank, { minIvRankPct: 45 }).passes).toBe(true);
    expect(applyIVRankFilter(30, { minIvRankPct: 45 }).passes).toBe(false);
  });
});

describe("strategy-options-engine straddle delta", () => {
  it("uses 0.15–0.30 band", () => {
    expect(STRADDLE_DELTA_RANGE.min).toBe(0.15);
    expect(STRADDLE_DELTA_RANGE.max).toBe(0.3);
    expect(straddleDeltaInRange(0.22)).toBe(true);
    expect(straddleDeltaInRange(0.4)).toBe(false);
    expect(straddleDeltaDistanceScore(0.22)).toBeLessThan(straddleDeltaDistanceScore(0.29));
  });
});
