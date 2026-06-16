import { describe, expect, it } from "vitest";

import {
  parseProfitFinderToolArgs,
  type ProfitFinderToolRequest
} from "@/modules/xchat/profit-finder-tool";

describe("profit-finder-tool", () => {
  it("defaults to conservative mode and both focus", () => {
    const out = parseProfitFinderToolArgs({});
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const req = out.payload as ProfitFinderToolRequest;
    expect(req.mode).toBe("conservative");
    expect(req.focus).toBe("both");
    expect(req.maxResults).toBe(12);
    expect(req.includeWatchlist).toBe(true);
  });

  it("accepts workspace portfolio id and symbol filter", () => {
    const portfolioId = "507f1f77bcf86cd799439011";
    const out = parseProfitFinderToolArgs(
      { mode: "balanced", focus: "income", symbol: "nvda" },
      { workspacePortfolioId: portfolioId }
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const req = out.payload as ProfitFinderToolRequest;
    expect(req.portfolioId).toBe(portfolioId);
    expect(req.symbols).toEqual(["NVDA"]);
    expect(req.mode).toBe("balanced");
    expect(req.focus).toBe("income");
  });

  it("rejects invalid maxResults", () => {
    const out = parseProfitFinderToolArgs({ maxResults: 99 });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error).toBe("invalid_profit_finder_context");
  });
});