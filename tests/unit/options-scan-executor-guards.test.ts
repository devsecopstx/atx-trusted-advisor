import { describe, expect, it, vi } from "vitest";

const optionsScanCacheMocks = vi.hoisted(() => ({
  tryGetOptionsScanCache: vi.fn(async () => null as string | null),
  setOptionsScanCache: vi.fn(async () => undefined),
  buildOptionsScanFingerprint: vi.fn((input: { symbol: string; filters: Record<string, unknown> }) =>
    `fp:${input.symbol}:${JSON.stringify(input.filters)}`
  )
}));

vi.mock("@/modules/xchat/options-scan-redis-cache", () => optionsScanCacheMocks);

vi.mock("@/modules/core-admin/repository", () => ({
  DEFAULT_ACCOUNT_CASH_BALANCE: 25_000,
  getDefaultPortfolio: vi.fn(),
  getPortfolioByIdForSessionUser: vi.fn(),
  getUserWatchlist: vi.fn(),
  listPortfolioAccounts: vi.fn(),
  listPortfolioPositionsByAccount: vi.fn(),
  ensurePortfolioWatchlistForUser: vi.fn(),
  mutatePortfolioWatchlistSymbols: vi.fn(),
  listScheduledTasks: vi.fn(),
  listTaskRuns: vi.fn(),
  provisionDefaultPortfolioForUser: vi.fn()
}));

vi.mock("@/modules/xchat/tool-cache", () => ({
  getCachedToolResult: () => null,
  setCachedToolResult: () => undefined,
  deleteCachedToolResult: vi.fn()
}));

const yahooMocks = vi.hoisted(() => ({
  getYahooFinance2: vi.fn(() => ({
    options: vi.fn(async () => ({ expirationDates: [] }))
  })),
  getYahooMarketQuote: vi.fn(async () => ({ symbol: "TSLA", price: 200, source: "yahoo" })),
  fetchYahooOptionChainForExpiration: vi.fn(async () => ({ optionChain: [] }))
}));

vi.mock("@/modules/yahoo/yahoo-finance-service", () => ({
  getYahooFinance2: yahooMocks.getYahooFinance2
}));

vi.mock("@/modules/xchat/market-data", () => ({
  getYahooMarketQuote: yahooMocks.getYahooMarketQuote
}));

vi.mock("@/modules/strategy-options/options-chain", () => ({
  fetchYahooOptionChainForExpiration: yahooMocks.fetchYahooOptionChainForExpiration
}));

import { createXfinanceToolExecutor } from "@/modules/xchat/tool-executor";
import type { WorkspaceSnapshotPreload } from "@/modules/xchat/workspace-snapshot-for-prompt";

function makePreload(totalPositionCount: number): WorkspaceSnapshotPreload {
  return {
    promptJson: {
      loadedAt: new Date().toISOString(),
      workspaceContentRev: 1,
      portfolio: {
        id: "507f1f77bcf86cd799439033",
        name: "Main",
        isDefault: true,
        totalPositionCount
      },
      accounts: [
        {
          accountId: "acc1",
          name: "Individual",
          type: "cash",
          extAccountId: "",
          isDefault: true,
          cashBalance: 1000,
          positionCount: totalPositionCount
        }
      ],
      positionsPreview: [],
      positionsPreviewTruncated: false,
      positionsOmittedCount: 0,
      watchlist: { error: "no_watchlist" }
    },
    positionsFull: []
  };
}

describe("createXfinanceToolExecutor — empty book covered-call guard", () => {
  it("returns empty_book_for_covered_call when call options_scan with zero positions", async () => {
    const executor = createXfinanceToolExecutor({
      userId: "u1",
      workspacePreload: makePreload(0)
    });
    const out = await executor("atx_function", {
      operation: "options_scan",
      symbol: "TSLA",
      optionType: "call"
    });
    expect(out.result).toContain("empty_book_for_covered_call");
    expect(out.result).toContain("507f1f77bcf86cd799439033");
    expect(yahooMocks.fetchYahooOptionChainForExpiration).not.toHaveBeenCalled();
    expect(optionsScanCacheMocks.tryGetOptionsScanCache).not.toHaveBeenCalled();
  });

  it("does not guard for put options_scan even with empty book (CSP entry path)", async () => {
    optionsScanCacheMocks.tryGetOptionsScanCache.mockResolvedValueOnce(
      JSON.stringify({ symbol: "TSLA", spot: 200, rows: [] })
    );
    const executor = createXfinanceToolExecutor({
      userId: "u1",
      workspacePreload: makePreload(0)
    });
    const out = await executor("atx_function", {
      operation: "options_scan",
      symbol: "TSLA",
      optionType: "put"
    });
    expect(out.result).not.toContain("empty_book_for_covered_call");
    expect(out.result).toContain("\"rows\":[]");
  });

  it("does not guard when positions exist", async () => {
    optionsScanCacheMocks.tryGetOptionsScanCache.mockResolvedValueOnce(
      JSON.stringify({ symbol: "TSLA", spot: 200, rows: [], note: "ok" })
    );
    const executor = createXfinanceToolExecutor({
      userId: "u1",
      workspacePreload: makePreload(5)
    });
    const out = await executor("atx_function", {
      operation: "options_scan",
      symbol: "TSLA",
      optionType: "call"
    });
    expect(out.result).not.toContain("empty_book_for_covered_call");
    expect(optionsScanCacheMocks.tryGetOptionsScanCache).toHaveBeenCalledTimes(1);
  });
});

describe("createXfinanceToolExecutor — per-request dedup", () => {
  it("memoizes repeated identical calls within one executor instance", async () => {
    optionsScanCacheMocks.tryGetOptionsScanCache.mockResolvedValueOnce(
      JSON.stringify({ symbol: "TSLA", spot: 200, rows: [{ strike: 200 }] })
    );
    const executor = createXfinanceToolExecutor({
      userId: "u1",
      workspacePreload: makePreload(5)
    });
    const args = { operation: "options_scan", symbol: "TSLA", optionType: "put" };
    const a = await executor("atx_function", args);
    const b = await executor("atx_function", args);
    expect(a.result).toBe(b.result);
    expect(optionsScanCacheMocks.tryGetOptionsScanCache).toHaveBeenCalledTimes(1);
  });
});
