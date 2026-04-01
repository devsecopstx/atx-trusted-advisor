import { describe, expect, it } from "vitest";

import { sliceStrikesAroundSpot } from "@/lib/xoptions/xoptions-chain-helpers";

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
