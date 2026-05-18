import { describe, expect, it } from "vitest";

import { buildYahooFinanceQuoteUrl } from "@/lib/yahoo-finance-url";

describe("buildYahooFinanceQuoteUrl", () => {
  it("builds symbol quote page when ticker is valid", () => {
    expect(buildYahooFinanceQuoteUrl("tsla")).toBe("https://finance.yahoo.com/quote/TSLA");
  });

  it("falls back to Yahoo Finance home without a ticker", () => {
    expect(buildYahooFinanceQuoteUrl()).toBe("https://finance.yahoo.com/");
    expect(buildYahooFinanceQuoteUrl("not a ticker")).toBe("https://finance.yahoo.com/");
  });
});
