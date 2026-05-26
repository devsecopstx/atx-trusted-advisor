import { describe, expect, it } from "vitest";

import {
  applyWatchlistDeskSort,
  watchlistQuickScore,
  type WatchlistDeskSortRow
} from "@/app/watchlist/ui/watchlist-desk-sort";

function row(partial: Partial<WatchlistDeskSortRow> & { symbol: string }): WatchlistDeskSortRow {
  return {
    symbol: partial.symbol,
    entryPrice: partial.entryPrice ?? null,
    quote: partial.quote ?? null,
    chainGlance: partial.chainGlance ?? null,
    technicals: partial.technicals ?? null
  };
}

describe("applyWatchlistDeskSort", () => {
  const rows: WatchlistDeskSortRow[] = [
    row({ symbol: "ZZZ", quote: { price: 10 } }),
    row({ symbol: "AAA", quote: { price: 30 } }),
    row({ symbol: "MMM", quote: { price: 20 } })
  ];

  it("sorts by symbol ascending", () => {
    const sorted = applyWatchlistDeskSort(rows, "symbol", "asc");
    expect(sorted.map((r) => r.symbol)).toEqual(["AAA", "MMM", "ZZZ"]);
  });

  it("sorts by spot descending", () => {
    const sorted = applyWatchlistDeskSort(rows, "spot", "desc");
    expect(sorted.map((r) => r.symbol)).toEqual(["AAA", "MMM", "ZZZ"]);
  });

  it("sorts by quick score with nulls last", () => {
    const scored: WatchlistDeskSortRow[] = [
      row({
        symbol: "LOW",
        quote: { price: 100 },
        entryPrice: 110,
        chainGlance: {
          impliedVolatilityPercent: 80,
          openInterest: 10_000,
          optionVolume: 5_000,
          expirationDate: "2026-06-20"
        },
        technicals: { rsi14: 55 }
      }),
      row({ symbol: "NOSCORE", quote: { price: 50 } }),
      row({
        symbol: "HIGH",
        quote: { price: 100 },
        entryPrice: 100,
        chainGlance: {
          impliedVolatilityPercent: 120,
          openInterest: 50_000,
          optionVolume: 25_000,
          expirationDate: "2026-06-20"
        },
        technicals: { rsi14: 72 }
      })
    ];
    const sorted = applyWatchlistDeskSort(scored, "quickScore", "desc");
    expect(sorted[0]?.symbol).toBe("HIGH");
    expect(sorted.at(-1)?.symbol).toBe("NOSCORE");
    expect(watchlistQuickScore(sorted[0]!)).toBeGreaterThan(watchlistQuickScore(sorted[1]!) ?? 0);
  });
});
