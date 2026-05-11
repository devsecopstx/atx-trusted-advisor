import { describe, expect, it } from "vitest";

import {
    heavySynthesisIntent,
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
