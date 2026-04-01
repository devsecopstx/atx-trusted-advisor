import { describe, expect, it } from "vitest";

import { filterStrikesBySpotBand, sliceStrikesAroundSpot } from "@/lib/xoptions/xoptions-chain-helpers";

describe("sliceStrikesAroundSpot", () => {
  it("returns a window of rows around spot", () => {
    const rows = [90, 95, 100, 105, 110, 115, 120, 125, 130].map((strike) => ({
      strike,
      k: strike
    }));
    const slice = sliceStrikesAroundSpot(rows, 100, 5);
    expect(slice).toHaveLength(5);
    expect(slice.map((r) => r.strike)).toContain(100);
  });

  it("handles short chains", () => {
    const rows = [{ strike: 100, k: 1 }];
    expect(sliceStrikesAroundSpot(rows, 100, 9)).toHaveLength(1);
  });
});

describe("filterStrikesBySpotBand", () => {
  it("keeps strikes within ±15% of spot by default", () => {
    const spot = 100;
    const rows = [70, 85, 86, 100, 114, 115, 130].map((strike) => ({ strike }));
    const out = filterStrikesBySpotBand(rows, spot);
    expect(out.map((r) => r.strike)).toEqual([85, 86, 100, 114, 115]);
  });

  it("returns all rows when band would be empty", () => {
    const rows = [{ strike: 200 }, { strike: 210 }];
    const out = filterStrikesBySpotBand(rows, 100, 0.15);
    expect(out).toEqual(rows);
  });
});
