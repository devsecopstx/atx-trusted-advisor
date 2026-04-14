import { describe, expect, it } from "vitest";

import { normalizeYahooBatchQuoteRow } from "@/modules/watchlist/yahoo-batch-quotes";

describe("normalizeYahooBatchQuoteRow", () => {
  it("maps 52-week range and display names from Yahoo quote shape", () => {
    const row = normalizeYahooBatchQuoteRow({
      symbol: "TSLA",
      regularMarketPrice: 250.5,
      shortName: "Tesla, Inc.",
      longName: "Tesla, Inc. Common Stock",
      fiftyTwoWeekLow: 200,
      fiftyTwoWeekHigh: 300.25
    });
    expect(row.symbol).toBe("TSLA");
    expect(row.price).toBe(250.5);
    expect(row.shortName).toBe("Tesla, Inc.");
    expect(row.longName).toBe("Tesla, Inc. Common Stock");
    expect(row.fiftyTwoWeekLow).toBe(200);
    expect(row.fiftyTwoWeekHigh).toBe(300.25);
  });

  it("omits optional fields when absent", () => {
    const row = normalizeYahooBatchQuoteRow({
      symbol: "QQQ",
      regularMarketPrice: 400
    });
    expect(row.fiftyTwoWeekLow).toBeUndefined();
    expect(row.fiftyTwoWeekHigh).toBeUndefined();
    expect(row.shortName).toBeUndefined();
  });
});
