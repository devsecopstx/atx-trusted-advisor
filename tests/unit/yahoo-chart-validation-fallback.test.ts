import { describe, expect, it, vi } from "vitest";

import {
    extractDailyClosesFromYahooChart,
    yahooChartWithValidationFallback
} from "@/modules/yahoo/yahoo-chart-validation-fallback";

describe("yahooChartWithValidationFallback", () => {
  it("calls chart with validateResult false (no schema log/throw)", async () => {
    const chart = vi.fn().mockResolvedValue({ quotes: [{ close: 10 }] });
    const yf = { chart };
    const options = { period1: new Date(), period2: new Date(), interval: "1d" };
    const out = await yahooChartWithValidationFallback(yf, "AAPL", options, "test");
    expect(chart).toHaveBeenCalledTimes(1);
    expect(chart).toHaveBeenCalledWith("AAPL", options, { validateResult: false });
    expect(extractDailyClosesFromYahooChart(out)).toEqual([10]);
  });
});

describe("extractDailyClosesFromYahooChart", () => {
  it("filters invalid closes", () => {
    expect(
      extractDailyClosesFromYahooChart({
        quotes: [{ close: 1 }, { close: null }, { close: -1 }, { close: 2.5 }]
      })
    ).toEqual([1, 2.5]);
  });
});
