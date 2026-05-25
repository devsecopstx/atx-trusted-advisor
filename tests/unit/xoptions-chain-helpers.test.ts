import { describe, expect, it } from "vitest";

import {
    chainHeatMixPercent,
    chainRowMoneynessClass,
    chainTableRowsTruncated,
    closestStrikeToSpot,
    filterOptionChainRowsByLiquidity,
    filterStrikesBySpotBand,
    formatImpliedVolatilityDisplay,
    legHasLiquiditySignal,
    legHasQuotableLastQuote,
    maxVolumeAndOpenInterestForSide,
    resolveChainTableRows,
    sliceStrikesAroundSpot
} from "@/lib/xoptions/xoptions-chain-helpers";

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

describe("closestStrikeToSpot", () => {
  it("returns strike nearest to spot", () => {
    expect(closestStrikeToSpot([90, 95, 100, 105], 102)).toBe(100);
    expect(closestStrikeToSpot([90, 95, 100, 105], 103)).toBe(105);
  });

  it("tie-breaks to lower strike when equidistant", () => {
    expect(closestStrikeToSpot([100, 110], 105)).toBe(100);
  });
});

describe("chainRowMoneynessClass", () => {
  it("marks ATM strike before ITM for calls", () => {
    expect(chainRowMoneynessClass(100, 105, "call", 100)).toBe("xoptions-contract-row--atm");
    expect(chainRowMoneynessClass(95, 105, "call", 100)).toBe("xoptions-contract-row--itm");
    expect(chainRowMoneynessClass(110, 105, "call", 100)).toBe("xoptions-contract-row--otm");
  });

  it("marks ATM for puts and ITM when strike above spot", () => {
    expect(chainRowMoneynessClass(100, 100, "put", 100)).toBe("xoptions-contract-row--atm");
    expect(chainRowMoneynessClass(110, 100, "put", 100)).toBe("xoptions-contract-row--itm");
    expect(chainRowMoneynessClass(90, 100, "put", 100)).toBe("xoptions-contract-row--otm");
  });
});

describe("formatImpliedVolatilityDisplay", () => {
  it("formats percent with two decimals", () => {
    expect(formatImpliedVolatilityDisplay(35.5)).toBe("35.50%");
    expect(formatImpliedVolatilityDisplay(null)).toBe("—");
  });
});

describe("chainHeatMixPercent", () => {
  it("returns 0 for invalid max or value", () => {
    expect(chainHeatMixPercent(10, 0)).toBe(0);
    expect(chainHeatMixPercent(-1, 100)).toBe(0);
    expect(chainHeatMixPercent(NaN, 100)).toBe(0);
  });

  it("scales linearly and caps at maxMixPercent", () => {
    expect(chainHeatMixPercent(50, 100, 20)).toBe(10);
    expect(chainHeatMixPercent(100, 100, 20)).toBe(20);
    expect(chainHeatMixPercent(200, 100, 20)).toBe(20);
  });
});

describe("maxVolumeAndOpenInterestForSide", () => {
  const q = (vol: number, oi: number, bid = 1, ask = 2) => ({
    last_quote: { bid, ask },
    volume: vol,
    open_interest: oi,
    implied_volatility: 30
  });

  it("returns max vol and OI for the active side among quotable legs", () => {
    const rows = [
      { strike: 100, call: q(500, 1000), put: q(10, 20) },
      { strike: 105, call: q(2000, 300), put: q(5, 5) }
    ];
    expect(maxVolumeAndOpenInterestForSide(rows, "call")).toEqual({ maxVol: 2000, maxOi: 1000 });
    expect(maxVolumeAndOpenInterestForSide(rows, "put")).toEqual({ maxVol: 10, maxOi: 20 });
  });

  it("ignores rows without quotable bid/ask", () => {
    const rows = [
      { strike: 100, call: { last_quote: { bid: NaN, ask: 1 }, volume: 999, open_interest: 1 }, put: q(1, 1) }
    ];
    expect(maxVolumeAndOpenInterestForSide(rows, "call")).toEqual({ maxVol: 0, maxOi: 0 });
  });
});

describe("filterOptionChainRowsByLiquidity", () => {
  const mkLeg = (openInterest: number, bid: number, ask: number) => ({
    last_quote: { bid, ask },
    open_interest: openInterest,
    implied_volatility: 10
  });

  it("keeps strikes with quoted bid/ask even when OI is 0 (illiquid names)", () => {
    const rows = [
      { strike: 9, call: mkLeg(0, 0.05, 0.06), put: mkLeg(0, 0.04, 0.05) },
      { strike: 10, call: mkLeg(7840, 0.06, 0.06), put: mkLeg(0, 0, 0) },
      { strike: 11, call: mkLeg(0, 0.02, 0.03), put: mkLeg(0, 0.01, 0.02) }
    ];
    const { rows: out, usedLiquidityFilter } = filterOptionChainRowsByLiquidity(rows);
    expect(usedLiquidityFilter).toBe(true);
    expect(out).toHaveLength(3);
  });

  it("returns full chain when no row has OI or non-zero bid/ask", () => {
    const rows = [
      {
        strike: 10,
        call: { last_quote: { bid: 0, ask: 0 }, open_interest: 0, implied_volatility: 10 },
        put: { last_quote: { bid: 0, ask: 0 }, open_interest: 0, implied_volatility: 10 }
      }
    ];
    const { rows: out, usedLiquidityFilter } = filterOptionChainRowsByLiquidity(rows);
    expect(usedLiquidityFilter).toBe(false);
    expect(out).toEqual(rows);
  });
});

describe("legHasQuotableLastQuote", () => {
  it("requires finite bid and ask", () => {
    expect(
      legHasQuotableLastQuote({
        last_quote: { bid: 1, ask: 2 },
        open_interest: 0
      })
    ).toBe(true);
    expect(
      legHasQuotableLastQuote({
        last_quote: { bid: NaN, ask: 1 },
        open_interest: 100
      })
    ).toBe(false);
    expect(legHasQuotableLastQuote({ open_interest: 100 } as never)).toBe(false);
    expect(legHasQuotableLastQuote(null)).toBe(false);
  });
});

describe("legHasLiquiditySignal", () => {
  it("is true for OI or positive bid/ask", () => {
    expect(
      legHasLiquiditySignal({
        last_quote: { bid: 0, ask: 0 },
        open_interest: 100
      })
    ).toBe(true);
    expect(
      legHasLiquiditySignal({
        last_quote: { bid: 0.05, ask: 0.06 },
        open_interest: 0
      })
    ).toBe(true);
    expect(
      legHasLiquiditySignal({
        last_quote: { bid: 0, ask: 0 },
        open_interest: 0
      })
    ).toBe(false);
    expect(legHasLiquiditySignal(null)).toBe(false);
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

describe("resolveChainTableRows", () => {
  const base = [80, 90, 95, 100, 105, 110, 120, 130].map((strike) => ({ strike }));
  const band = filterStrikesBySpotBand(base, 100);

  it("returns full sorted chain when showAllStrikes is true", () => {
    const out = resolveChainTableRows(base, band, {
      showAllStrikes: true,
      maxVisibleRows: 5,
      spot: 100
    });
    expect(out.map((r) => r.strike)).toEqual([80, 90, 95, 100, 105, 110, 120, 130]);
  });

  it("slices around spot when showAllStrikes is false", () => {
    const out = resolveChainTableRows(base, band, {
      showAllStrikes: false,
      maxVisibleRows: 5,
      spot: 100
    });
    expect(out).toHaveLength(5);
    expect(out.map((r) => r.strike)).toContain(100);
  });

  it("returns empty when base rows are empty", () => {
    expect(
      resolveChainTableRows([], [], {
        showAllStrikes: false,
        maxVisibleRows: 5,
        spot: 100
      })
    ).toEqual([]);
  });
});

describe("chainTableRowsTruncated", () => {
  const base = [90, 95, 100, 105, 110, 115, 120].map((strike) => ({ strike }));
  const band = filterStrikesBySpotBand(base, 100);

  it("is false when show all strikes is on", () => {
    expect(
      chainTableRowsTruncated(base, band, { showAllStrikes: true, maxVisibleRows: 5 })
    ).toBe(false);
  });

  it("is true when compact window hides rows", () => {
    expect(
      chainTableRowsTruncated(base, band, { showAllStrikes: false, maxVisibleRows: 5 })
    ).toBe(true);
  });
});
