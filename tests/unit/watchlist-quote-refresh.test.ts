import { describe, expect, it } from "vitest";

import { watchlistPatchShouldRefetchQuotes } from "@/app/watchlist/ui/watchlist-quote-refresh";

describe("watchlistPatchShouldRefetchQuotes", () => {
  it("refetches when Spring BFF omits Yahoo lookup", () => {
    expect(watchlistPatchShouldRefetchQuotes({ symbolLookupEnabled: false }, {})).toBe(true);
  });

  it("refetches on add, remove, or dedupe even when lookup is enabled", () => {
    expect(
      watchlistPatchShouldRefetchQuotes({ symbolLookupEnabled: true }, { addSymbols: ["AAPL"] })
    ).toBe(true);
    expect(
      watchlistPatchShouldRefetchQuotes({ symbolLookupEnabled: true }, { removeSymbols: ["TSLA"] })
    ).toBe(true);
    expect(watchlistPatchShouldRefetchQuotes({ symbolLookupEnabled: true }, { dedupe: true })).toBe(true);
  });

  it("skips refetch for metadata-only patches when lookup is enabled", () => {
    expect(
      watchlistPatchShouldRefetchQuotes(
        { symbolLookupEnabled: true },
        { addEntries: [{ symbol: "TSLA", rationale: "test" }] }
      )
    ).toBe(false);
  });
});
