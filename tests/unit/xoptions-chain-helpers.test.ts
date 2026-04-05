import { describe, expect, it } from "vitest";

import {
    chainRowMoneynessClass,
    closestStrikeToSpot,
    filterOptionChainRowsByLiquidity,
    filterStrikesBySpotBand,
    formatImpliedVolatilityDisplay,
    legHasLiquiditySignal,
    legHasQuotableLastQuote,
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
    expect(chainRowMoneynessClass(110, 105, "call", 100)).toBe("");
  });

  it("marks ATM for puts and ITM when strike above spot", () => {
    expect(chainRowMoneynessClass(100, 100, "put", 100)).toBe("xoptions-contract-row--atm");
    expect(chainRowMoneynessClass(110, 100, "put", 100)).toBe("xoptions-contract-row--itm");
  });
});

describe("formatImpliedVolatilityDisplay", () => {
  it("formats percent with two decimals", () => {
    expect(formatImpliedVolatilityDisplay(35.5)).toBe("35.50%");
    expect(formatImpliedVolatilityDisplay(null)).toBe("—");
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
