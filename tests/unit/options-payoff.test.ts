import { describe, expect, it } from "vitest";

import {
    buildPayoffSeries,
    calculateNetPayoffAtExpiration,
    estimateBreakevenPrices,
    getUniqueStrikes,
    type OptionsPayoffLeg
} from "@/lib/options-payoff";

describe("options payoff math", () => {
  it("calculates multi-leg payoff for long call spread", () => {
    const legs: OptionsPayoffLeg[] = [
      { id: "1", type: "call", strike: 100, premium: 5, quantity: 1, side: "long" },
      { id: "2", type: "call", strike: 110, premium: 2, quantity: 1, side: "short" }
    ];

    expect(calculateNetPayoffAtExpiration(legs, 100)).toBeCloseTo(-300, 6);
    expect(calculateNetPayoffAtExpiration(legs, 103)).toBeCloseTo(0, 6);
    expect(calculateNetPayoffAtExpiration(legs, 120)).toBeCloseTo(700, 6);
  });

  it("finds unique strikes and breakeven approximations for mixed legs", () => {
    const legs: OptionsPayoffLeg[] = [
      { id: "1", type: "put", strike: 95, premium: 2.5, quantity: 1, side: "short" },
      { id: "2", type: "call", strike: 105, premium: 2.5, quantity: 1, side: "short" },
      { id: "3", type: "call", strike: 115, premium: 1, quantity: 1, side: "long" }
    ];

    expect(getUniqueStrikes(legs)).toEqual([95, 105, 115]);

    const series = buildPayoffSeries(legs, 100, { minPrice: 70, maxPrice: 140, pointCount: 400 });
    const breakevens = estimateBreakevenPrices(series);

    expect(breakevens.length).toBeGreaterThan(0);
    expect(breakevens[0]).toBeGreaterThan(90);
    expect(breakevens[0]).toBeLessThan(110);
  });
});
