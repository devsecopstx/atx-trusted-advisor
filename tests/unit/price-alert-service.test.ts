import { describe, expect, it } from "vitest";

import {
    DEFAULT_MIN_ABS_MOVE_PERCENT,
    evaluateSignificantPriceMoves,
} from "@/modules/watchlist/price-alert-service";

describe("evaluateSignificantPriceMoves", () => {
  it("returns empty when no prior lastPrice", () => {
    const r = evaluateSignificantPriceMoves(
      [{ symbol: "TSLA", addedAt: new Date() }],
      [{ symbol: "TSLA", lastPrice: 300 }],
      DEFAULT_MIN_ABS_MOVE_PERCENT
    );
    expect(r).toEqual([]);
  });

  it("skips when prior lastPrice is zero", () => {
    const r = evaluateSignificantPriceMoves(
      [{ symbol: "TSLA", addedAt: new Date(), lastPrice: 0 }],
      [{ symbol: "TSLA", lastPrice: 300 }],
      DEFAULT_MIN_ABS_MOVE_PERCENT
    );
    expect(r).toEqual([]);
  });

  it("fires when move exceeds threshold (up)", () => {
    const r = evaluateSignificantPriceMoves(
      [{ symbol: "TSLA", addedAt: new Date(), lastPrice: 100 }],
      [{ symbol: "TSLA", lastPrice: 106 }],
      DEFAULT_MIN_ABS_MOVE_PERCENT
    );
    expect(r).toHaveLength(1);
    expect(r[0]?.symbol).toBe("TSLA");
    expect(r[0]?.newPrice).toBe(106);
    expect(r[0]?.changePct).toBeCloseTo(6, 5);
  });

  it("fires when move exceeds threshold (down)", () => {
    const r = evaluateSignificantPriceMoves(
      [{ symbol: "TSLA", addedAt: new Date(), lastPrice: 100 }],
      [{ symbol: "TSLA", lastPrice: 94 }],
      DEFAULT_MIN_ABS_MOVE_PERCENT
    );
    expect(r).toHaveLength(1);
    expect(r[0]?.changePct).toBeCloseTo(6, 5);
  });

  it("does not fire at exactly threshold (strict >)", () => {
    const r = evaluateSignificantPriceMoves(
      [{ symbol: "TSLA", addedAt: new Date(), lastPrice: 100 }],
      [{ symbol: "TSLA", lastPrice: 105 }],
      DEFAULT_MIN_ABS_MOVE_PERCENT
    );
    expect(r).toEqual([]);
  });

  it("respects custom min percent", () => {
    const r = evaluateSignificantPriceMoves(
      [{ symbol: "TSLA", addedAt: new Date(), lastPrice: 100 }],
      [{ symbol: "TSLA", lastPrice: 102 }],
      1
    );
    expect(r).toHaveLength(1);
    expect(r[0]?.changePct).toBeCloseTo(2, 5);
  });
});
