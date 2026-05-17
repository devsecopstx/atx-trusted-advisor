import { describe, expect, it, vi } from "vitest";

import {
    extractDailyClosesFromYahooChart,
    isYahooChartSchemaValidationError,
    yahooChartWithValidationFallback
} from "@/modules/yahoo/yahoo-chart-validation-fallback";

describe("yahooChartWithValidationFallback", () => {
  it("detects chart schema validation errors", () => {
    expect(
      isYahooChartSchemaValidationError(
        new Error("Failed validation: #/definitions/ChartResultObject")
      )
    ).toBe(true);
    expect(isYahooChartSchemaValidationError(new Error("network"))).toBe(false);
  });

  it("retries chart with validateResult: false", async () => {
    const chart = vi
      .fn()
      .mockRejectedValueOnce(new Error("Failed validation: #/definitions/ChartResultObject"))
      .mockResolvedValueOnce({ quotes: [{ close: 10 }] });
    const yf = { chart };
    const out = await yahooChartWithValidationFallback(
      yf,
      "AAPL",
      { period1: new Date(), period2: new Date(), interval: "1d" },
      "test"
    );
    expect(chart).toHaveBeenCalledTimes(2);
    expect(chart.mock.calls[1]?.[2]).toEqual({ validateResult: false });
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
