import { describe, expect, it } from "vitest";

import {
    lastPriceFromRawWatchlistEntry,
    mergeBaseFromRawWatchlistEntry,
    symbolFromRawWatchlistEntry,
    watchlistRowDeskMeta
} from "@/modules/watchlist/watchlist-row-raw";

describe("symbolFromRawWatchlistEntry", () => {
  it("reads string tickers", () => {
    expect(symbolFromRawWatchlistEntry(" tsla ")).toBe("TSLA");
  });

  it("reads object.symbol", () => {
    expect(symbolFromRawWatchlistEntry({ symbol: "aapl" })).toBe("AAPL");
  });

  it("returns null for empty / invalid", () => {
    expect(symbolFromRawWatchlistEntry("")).toBeNull();
    expect(symbolFromRawWatchlistEntry({ symbol: "" })).toBeNull();
    expect(symbolFromRawWatchlistEntry(null)).toBeNull();
  });
});

describe("watchlistRowDeskMeta", () => {
  it("reads desk fields from objects", () => {
    expect(
      watchlistRowDeskMeta({
        symbol: "X",
        rationale: "a",
        lineType: "opt",
        strategy: "put"
      })
    ).toEqual({ rationale: "a", lineType: "opt", strategy: "put" });
  });

  it("returns empty for strings", () => {
    expect(watchlistRowDeskMeta("TSLA")).toEqual({});
  });
});

describe("lastPriceFromRawWatchlistEntry", () => {
  it("reads numeric and string lastPrice", () => {
    expect(lastPriceFromRawWatchlistEntry({ symbol: "X", lastPrice: 12.5 })).toBe(12.5);
    expect(lastPriceFromRawWatchlistEntry({ symbol: "X", lastPrice: "100.25" })).toBe(100.25);
  });

  it("returns undefined for strings and missing", () => {
    expect(lastPriceFromRawWatchlistEntry("TSLA")).toBeUndefined();
    expect(lastPriceFromRawWatchlistEntry({ symbol: "X" })).toBeUndefined();
  });
});

describe("mergeBaseFromRawWatchlistEntry", () => {
  it("builds object from string row", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const b = mergeBaseFromRawWatchlistEntry("TSLA", now);
    expect(b.symbol).toBe("TSLA");
    expect(b.addedAt).toEqual(now);
  });

  it("shallow-clones object rows", () => {
    const row = { symbol: "X", addedAt: new Date(), rationale: "x" };
    const b = mergeBaseFromRawWatchlistEntry(row, new Date());
    expect(b.rationale).toBe("x");
    expect(b).not.toBe(row);
  });
});
