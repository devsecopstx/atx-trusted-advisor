import { describe, expect, it } from "vitest";

import {
    extractDirectQuoteSymbol,
    heavySynthesisIntent,
    isDirectTickerQuoteIntent,
    isShowWatchlistIntent,
    shouldEagerWorkspaceSnapshotPreloadForMessage,
    shouldOfferStrategyJobPreflight,
    shouldRunOptionsActionScan
} from "@/modules/xchat/xchat-ask-routing";

describe("heavySynthesisIntent", () => {
  it("is false for short factual prompts", () => {
    expect(heavySynthesisIntent("What is the VIX?")).toBe(false);
  });

  it("is true for explicit red-team style asks", () => {
    expect(heavySynthesisIntent("red team my thesis on TSLA")).toBe(true);
  });

  it("is true for very long messages", () => {
    expect(heavySynthesisIntent("x".repeat(2900))).toBe(true);
  });
});

describe("shouldRunOptionsActionScan", () => {
  it("matches the workspace scan template prompt", () => {
    expect(shouldRunOptionsActionScan("Scan my options from holdings + watchlist.")).toBe(true);
  });

  it("ignores unrelated chat", () => {
    expect(shouldRunOptionsActionScan("What is a covered call?")).toBe(false);
  });
});

describe("shouldOfferStrategyJobPreflight", () => {
  it("matches covered call phrasing", () => {
    expect(shouldOfferStrategyJobPreflight("Help me set up a covered call on MSFT")).toBe(true);
  });

  it("ignores unrelated chat", () => {
    expect(shouldOfferStrategyJobPreflight("What is a stock?")).toBe(false);
  });
});

describe("isDirectTickerQuoteIntent", () => {
  it("matches ticker + quote phrasing", () => {
    expect(isDirectTickerQuoteIntent("TSLA quote")).toBe(true);
    expect(extractDirectQuoteSymbol("TSLA quote")).toBe("TSLA");
    expect(isDirectTickerQuoteIntent("quote for NVDA")).toBe(true);
    expect(extractDirectQuoteSymbol("quote for NVDA")).toBe("NVDA");
  });

  it("ignores watchlist and options desk asks", () => {
    expect(isDirectTickerQuoteIntent("show my watchlist")).toBe(false);
    expect(isDirectTickerQuoteIntent("TSLA covered call ideas")).toBe(false);
  });
});

describe("isShowWatchlistIntent", () => {
  it("matches direct watchlist asks including typos", () => {
    expect(isShowWatchlistIntent("show my watchlist")).toBe(true);
    expect(isShowWatchlistIntent("show my  watchlist")).toBe(true);
    expect(isShowWatchlistIntent(";show my watchlist")).toBe(true);
    expect(isShowWatchlistIntent("show me my watchlist")).toBe(true);
    expect(isShowWatchlistIntent("show my watchlist report")).toBe(true);
    expect(isShowWatchlistIntent("how my watchlist")).toBe(true);
    expect(isShowWatchlistIntent("how is my watchlist")).toBe(true);
    expect(isShowWatchlistIntent("what's on my watchlist")).toBe(true);
  });

  it("excludes mutating watchlist flows", () => {
    expect(isShowWatchlistIntent("watchlist add TSLA")).toBe(false);
  });
});

describe("shouldEagerWorkspaceSnapshotPreloadForMessage", () => {
  it("is true for HNWI wheel/CC template (holdings + watchlist)", () => {
    expect(
      shouldEagerWorkspaceSnapshotPreloadForMessage(
        "From holdings + watchlist: up to three covered-call or wheel ideas with strike/expiry notes."
      )
    ).toBe(true);
  });

  it("is true when book + income cues combine", () => {
    expect(
      shouldEagerWorkspaceSnapshotPreloadForMessage(
        "Covered call ideas using my watchlist and portfolio context"
      )
    ).toBe(true);
  });

  it("is true for wheel ideas phrasing without holdings phrase", () => {
    expect(
      shouldEagerWorkspaceSnapshotPreloadForMessage(
        "Give me three wheel ideas for premium income"
      )
    ).toBe(true);
  });

  it("is false for generic education without book cues", () => {
    expect(shouldEagerWorkspaceSnapshotPreloadForMessage("What is a covered call?")).toBe(false);
  });

  it("is false for watchlist mutate flows", () => {
    expect(
      shouldEagerWorkspaceSnapshotPreloadForMessage("watchlist add NVDA")
    ).toBe(false);
  });
});
