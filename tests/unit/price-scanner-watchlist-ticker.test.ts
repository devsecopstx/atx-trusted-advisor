import { describe, expect, it } from "vitest";

import { priceScannerNormalizedWatchlistTicker } from "@/modules/scanner/price-scanner-job";

describe("priceScannerNormalizedWatchlistTicker", () => {
  it("reads legacy string tickers", () => {
    expect(priceScannerNormalizedWatchlistTicker(" tsla ")).toBe("TSLA");
  });

  it("reads object.symbol", () => {
    expect(priceScannerNormalizedWatchlistTicker({ symbol: "AAPL" })).toBe("AAPL");
  });

  it("returns null when symbol missing", () => {
    expect(priceScannerNormalizedWatchlistTicker({ lineType: "stock" })).toBeNull();
    expect(priceScannerNormalizedWatchlistTicker("")).toBeNull();
  });
});
