import { describe, expect, it } from "vitest";

import { resolveXchatToolUsageOperation } from "@/modules/xchat/tool-usage-repository";

describe("resolveXchatToolUsageOperation", () => {
  it("maps yahoo_finance to market_quote", () => {
    expect(resolveXchatToolUsageOperation("yahoo_finance", {})).toBe("market_quote");
  });

  it("reads operation from atx_function calls (wire name from xAI Responses)", () => {
    expect(
      resolveXchatToolUsageOperation("atx_function", { operation: "portfolio_summary" })
    ).toBe("portfolio_summary");
  });

  it("still accepts legacy atxfinance executor test name", () => {
    expect(
      resolveXchatToolUsageOperation("atxfinance", { operation: "watchlist_snapshot" })
    ).toBe("watchlist_snapshot");
  });

  it("returns undefined for unknown tools or missing operation", () => {
    expect(resolveXchatToolUsageOperation("web_search", { query: "x" })).toBeUndefined();
    expect(resolveXchatToolUsageOperation("atx_function", {})).toBeUndefined();
  });
});
