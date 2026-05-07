import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/scanner/us-market-day-context", () => ({
  resolveUsMarketDayContext: vi.fn(() => ({
    marketDate: "2026-05-06",
    timezone: "America/New_York",
    isBusinessDay: true,
    isHoliday: false,
    marketWindowOpen: true
  }))
}));

import { resolveUsMarketDayContext } from "@/modules/scanner/us-market-day-context";
import {
    looksLikePortfolioOrOptionsWorkspaceQuery,
    messageRequestsLiveMarketRefresh,
    resolveWorkspaceSnapshotQuoteNetwork
} from "@/modules/xchat/xchat-workspace-quote-policy";

describe("xchat-workspace-quote-policy", () => {
  beforeEach(() => {
    vi.mocked(resolveUsMarketDayContext).mockReturnValue({
      marketDate: "2026-05-06",
      timezone: "America/New_York",
      isBusinessDay: true,
      isHoliday: false,
      marketWindowOpen: true
    });
  });

  it("detects live refresh phrases", () => {
    expect(messageRequestsLiveMarketRefresh("please live refresh my quotes")).toBe(true);
    expect(messageRequestsLiveMarketRefresh("fresh quotes for TSLA")).toBe(true);
    expect(messageRequestsLiveMarketRefresh("hello")).toBe(false);
  });

  it("classifies portfolio-style prompts", () => {
    expect(looksLikePortfolioOrOptionsWorkspaceQuery("how is my portfolio")).toBe(true);
    expect(looksLikePortfolioOrOptionsWorkspaceQuery("covered call on TSLA")).toBe(true);
    expect(looksLikePortfolioOrOptionsWorkspaceQuery("hi")).toBe(false);
  });

  it("uses cached_first for fast mode + workspace prompt when market is open", () => {
    expect(
      resolveWorkspaceSnapshotQuoteNetwork({
        message: "Summarize my watchlist risk",
        reasoningMode: "fast",
        reasoningEffort: undefined,
        clientQuoteFreshness: undefined
      })
    ).toBe("cached_first");
  });

  it("forces live for expert / heavy or reasoningEffort", () => {
    expect(
      resolveWorkspaceSnapshotQuoteNetwork({
        message: "Summarize my watchlist risk",
        reasoningMode: "expert",
        reasoningEffort: undefined,
        clientQuoteFreshness: undefined
      })
    ).toBe("live");
    expect(
      resolveWorkspaceSnapshotQuoteNetwork({
        message: "Summarize my watchlist risk",
        reasoningMode: undefined,
        reasoningEffort: "medium",
        clientQuoteFreshness: undefined
      })
    ).toBe("live");
  });

  it("forces live when market is closed", () => {
    vi.mocked(resolveUsMarketDayContext).mockReturnValue({
      marketDate: "2026-05-06",
      timezone: "America/New_York",
      isBusinessDay: false,
      isHoliday: false,
      marketWindowOpen: false
    });
    expect(
      resolveWorkspaceSnapshotQuoteNetwork({
        message: "Summarize my watchlist risk",
        reasoningMode: "fast",
        reasoningEffort: undefined,
        clientQuoteFreshness: undefined
      })
    ).toBe("live");
  });

  it("honors client live preference", () => {
    expect(
      resolveWorkspaceSnapshotQuoteNetwork({
        message: "hi",
        reasoningMode: "fast",
        reasoningEffort: undefined,
        clientQuoteFreshness: "live"
      })
    ).toBe("live");
  });
});
