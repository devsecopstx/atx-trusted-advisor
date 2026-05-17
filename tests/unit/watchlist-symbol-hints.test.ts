import { describe, expect, it } from "vitest";

import { suggestWatchlistTickerCorrection } from "@/modules/watchlist/watchlist-symbol-hints";

describe("suggestWatchlistTickerCorrection", () => {
  it("suggests AAPL for APPL", () => {
    expect(suggestWatchlistTickerCorrection("APPL")).toBe("AAPL");
  });

  it("returns null for valid tickers without mapping", () => {
    expect(suggestWatchlistTickerCorrection("AAPL")).toBeNull();
  });
});
