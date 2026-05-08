import { describe, expect, it } from "vitest";

import {
    parseSymbolChartRange,
    resolveYahooChartWindow,
    type SymbolChartRangeId
} from "@/modules/yahoo/symbol-chart-range";

describe("parseSymbolChartRange", () => {
  it("defaults invalid or missing input to 6m", () => {
    expect(parseSymbolChartRange(null)).toBe("6m");
    expect(parseSymbolChartRange("")).toBe("6m");
    expect(parseSymbolChartRange("invalid")).toBe("6m");
  });

  it("accepts allowed ids case-insensitively", () => {
    expect(parseSymbolChartRange("1D")).toBe("1d");
    expect(parseSymbolChartRange("1Y")).toBe("1y");
  });
});

describe("resolveYahooChartWindow", () => {
  const frozen = new Date("2026-05-07T18:00:00.000Z");

  it("uses intraday intervals for short ranges", () => {
    const d = resolveYahooChartWindow("1d", frozen);
    expect(d.interval).toBe("5m");
    expect(d.period2.getTime()).toBe(frozen.getTime());
    expect(d.period1.getTime()).toBeLessThan(d.period2.getTime());
  });

  it("uses weekly bars for 5y", () => {
    const w = resolveYahooChartWindow("5y", frozen);
    expect(w.interval).toBe("1wk");
    const spanDays = (w.period2.getTime() - w.period1.getTime()) / (24 * 60 * 60 * 1000);
    expect(spanDays).toBeGreaterThanOrEqual(5 * 365 - 2);
  });

  it("covers every SymbolChartRangeId", () => {
    const ids: SymbolChartRangeId[] = ["1d", "1w", "1m", "3m", "6m", "1y", "5y"];
    for (const id of ids) {
      const win = resolveYahooChartWindow(id, frozen);
      expect(win.period1.getTime()).toBeLessThan(win.period2.getTime());
      expect(["5m", "15m", "1d", "1wk"]).toContain(win.interval);
    }
  });
});
