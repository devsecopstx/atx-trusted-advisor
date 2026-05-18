import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  DEFAULT_ACCOUNT_CASH_BALANCE: 25_000,
  getDefaultPortfolio: vi.fn(),
  getPortfolioByIdForSessionUser: vi.fn(),
  ensurePortfolioWatchlistForUser: vi.fn(),
  provisionDefaultPortfolioForUser: vi.fn(),
  listPortfolioAccounts: vi.fn(),
  listPortfolioPositionsByAccount: vi.fn(),
  getPortfolioWatchlist: vi.fn(),
  getUserWatchlist: vi.fn(),
  mutatePortfolioWatchlistSymbols: vi.fn(),
  listScheduledTasks: vi.fn(),
  listTaskRuns: vi.fn()
}));

const marketDataMocks = vi.hoisted(() => ({
  getYahooMarketQuote: vi.fn()
}));

const watchlistLiveQuoteMocks = vi.hoisted(() => ({
  resolveLiveQuotesForWatchlistSymbols: vi.fn()
}));

const optionsActionScanMocks = vi.hoisted(() => ({
  buildOptionsActionReport: vi.fn()
}));

vi.mock("@/modules/core-admin/repository", () => repositoryMocks);
vi.mock("@/modules/xchat/market-data", () => marketDataMocks);
vi.mock("@/modules/watchlist/watchlist-live-quotes", () => watchlistLiveQuoteMocks);
vi.mock("@/modules/xchat/options-action-scan", () => optionsActionScanMocks);
vi.mock("@/modules/xchat/tool-cache", () => ({
  getCachedToolResult: () => null,
  setCachedToolResult: () => undefined,
  deleteCachedToolResult: vi.fn()
}));

const yahooLookupMocks = vi.hoisted(() => ({
  lookupSymbols: vi.fn()
}));

vi.mock("@/modules/watchlist/yahoo-symbol-lookup", () => ({
  lookupSymbols: yahooLookupMocks.lookupSymbols,
  LOOKUP_ROUTE: "yahoo-finance2"
}));

const nlPriceAlertMocks = vi.hoisted(() => ({
  upsertActivePortfolioPriceAlert: vi.fn(),
  listActivePortfolioPriceAlertsForUser: vi.fn(),
  countActivePortfolioPriceAlertsForTenant: vi.fn(),
  migrateLegacyNlPriceAlertsIfNeeded: vi.fn(),
  ensureUserAlertManagerScheduledTaskForTenant: vi.fn()
}));

const resolvePortfolioHintMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/price-alerts/portfolio-price-alerts-repository", () => ({
  upsertActivePortfolioPriceAlert: nlPriceAlertMocks.upsertActivePortfolioPriceAlert,
  listActivePortfolioPriceAlertsForUser: nlPriceAlertMocks.listActivePortfolioPriceAlertsForUser,
  countActivePortfolioPriceAlertsForTenant: nlPriceAlertMocks.countActivePortfolioPriceAlertsForTenant,
  deleteActivePortfolioPriceAlertForUserSymbol: vi.fn(),
  deleteAllActivePortfolioPriceAlertsForUser: vi.fn()
}));

vi.mock("@/modules/price-alerts/migrate-legacy-nl-price-alerts", () => ({
  migrateLegacyNlPriceAlertsIfNeeded: nlPriceAlertMocks.migrateLegacyNlPriceAlertsIfNeeded
}));

vi.mock("@/modules/price-alerts/ensure-user-alert-manager-task", () => ({
  ensureUserAlertManagerScheduledTaskForTenant: nlPriceAlertMocks.ensureUserAlertManagerScheduledTaskForTenant
}));

vi.mock("@/modules/price-alerts/resolve-portfolio-hint", () => ({
  resolvePortfolioHintFromNl: resolvePortfolioHintMock
}));

vi.mock("@/modules/audit/repository", () => ({
  createAuditEvent: vi.fn(() => Promise.resolve(undefined))
}));

const workspaceLoadMocks = vi.hoisted(() => ({
  loadWorkspaceSnapshotPreload: vi.fn()
}));

vi.mock("@/modules/xchat/workspace-snapshot-for-prompt", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/xchat/workspace-snapshot-for-prompt")>();
  return { ...actual, loadWorkspaceSnapshotPreload: workspaceLoadMocks.loadWorkspaceSnapshotPreload };
});

import {
    ATXFINANCE_TOOL_DEFINITION,
    createXfinanceToolExecutor
} from "@/modules/xchat/tool-executor";
import {
    formatWatchlistAddedAtUtc,
    formatWatchlistSpotPriceUsd,
    formatWatchlistTargetEntryNotional100xFromQuotePrice,
    formatWatchlistTargetEntryNotional100xUsd,
    formatWatchlistTargetEntryStored
} from "@/modules/xchat/watchlist-prompt-format";

const WL_QUOTE_FIXTURE = 250.12;

function wlSymbolFixture(symbol: string, addedAtIso: string, entryPrice?: number) {
  const hasEntry = entryPrice !== undefined;
  return {
    symbol,
    addedAt: addedAtIso,
    addedAtDisplay: formatWatchlistAddedAtUtc(addedAtIso),
    spotPriceDisplay: formatWatchlistSpotPriceUsd(WL_QUOTE_FIXTURE),
    targetEntryNotional100xUsdDisplay: formatWatchlistTargetEntryNotional100xUsd(WL_QUOTE_FIXTURE),
    ...(hasEntry ? { entryPrice, targetEntryPrice: entryPrice } : {}),
    targetEntryDisplay: formatWatchlistTargetEntryStored(entryPrice),
    targetEntryNotional100xDisplay: formatWatchlistTargetEntryNotional100xFromQuotePrice(WL_QUOTE_FIXTURE)
  };
}

describe("atxfinance tool executor", () => {
  const ctx = { userId: "user_123", tenantId: "tenant_456" };
  const portfolioId = new ObjectId();
  const accountId = new ObjectId();

  beforeEach(() => {
    yahooLookupMocks.lookupSymbols.mockImplementation(async (symbols: string[]) => {
      const m = new Map<string, { symbol: string; price: number; source: string }>();
      for (const s of symbols) {
        m.set(s, { symbol: s, price: WL_QUOTE_FIXTURE, source: "yahoo-finance2" });
      }
      return m;
    });
    watchlistLiveQuoteMocks.resolveLiveQuotesForWatchlistSymbols.mockImplementation(
      async (symbols: string[]) => {
        const m = new Map<
          string,
          { symbol: string; price: number; source: "yahoo-finance2"; disclaimer: string }
        >();
        for (const s of symbols) {
          const sym = s.trim().toUpperCase();
          m.set(sym, {
            symbol: sym,
            price: WL_QUOTE_FIXTURE,
            source: "yahoo-finance2",
            disclaimer: "test"
          });
        }
        return m;
      }
    );
    workspaceLoadMocks.loadWorkspaceSnapshotPreload.mockReset();
    workspaceLoadMocks.loadWorkspaceSnapshotPreload.mockResolvedValue(null);
    repositoryMocks.getDefaultPortfolio.mockResolvedValue({
      _id: portfolioId,
      name: "Default Portfolio",
      isDefault: true
    });
    repositoryMocks.getPortfolioByIdForSessionUser.mockResolvedValue({
      _id: portfolioId,
      name: "Default Portfolio",
      isDefault: true
    });
    repositoryMocks.listPortfolioAccounts.mockResolvedValue([
      {
        _id: accountId,
        name: "Default Account",
        type: "fidelity",
        extAccountId: "ext_account_xref",
        isDefault: true,
        cashBalance: 25_000
      }
    ]);
    repositoryMocks.listPortfolioPositionsByAccount.mockResolvedValue([
      {
        symbol: "TSLA",
        qty: 10,
        avgCost: 200,
        accountId,
        portfolioId,
        userId: "user_123"
      }
    ]);
    repositoryMocks.getPortfolioWatchlist.mockResolvedValue({
      name: "DefaultWatchlist",
      symbols: [{ symbol: "TSLA", addedAt: new Date(), entryPrice: 240.5 }]
    });
    repositoryMocks.getUserWatchlist.mockImplementation(
      async (input: { userId: string; tenantId?: string }) =>
        repositoryMocks.getPortfolioWatchlist({
          userId: input.userId,
          portfolioId: portfolioId.toHexString(),
          tenantId: input.tenantId
        })
    );
    repositoryMocks.ensurePortfolioWatchlistForUser.mockImplementation(async (input: { userId: string }) => {
      return repositoryMocks.getPortfolioWatchlist({
        userId: input.userId,
        portfolioId: portfolioId.toHexString(),
        tenantId: ctx.tenantId
      });
    });
    repositoryMocks.mutatePortfolioWatchlistSymbols.mockImplementation(
      async ({ addSymbols, addEntries, removeSymbols, riskProfile, outlook }) => {
        let symbols: Array<{
          symbol: string;
          addedAt: Date;
          lineType?: string;
          strategy?: string;
        }> = [{ symbol: "TSLA", addedAt: new Date() }];
        if (removeSymbols?.length) {
          const rm = new Set(removeSymbols.map((s: string) => s.toUpperCase()));
          symbols = symbols.filter((s: { symbol: string }) => !rm.has(s.symbol));
        }
        if (addSymbols?.length) {
          const now = new Date();
          for (const s of addSymbols) {
            const sym = s.toUpperCase();
            if (!symbols.some((x) => x.symbol === sym)) {
              symbols.push({ symbol: sym, addedAt: now });
            }
          }
        }
        if (addEntries?.length) {
          const now = new Date();
          for (const e of addEntries as Array<{
            symbol: string;
            lineType?: string | null;
            strategy?: string | null;
          }>) {
            const sym = e.symbol.toUpperCase();
            const idx = symbols.findIndex((x) => x.symbol === sym);
            if (idx >= 0) {
              symbols[idx] = {
                ...symbols[idx],
                ...(e.lineType != null ? { lineType: e.lineType } : {}),
                ...(e.strategy != null ? { strategy: e.strategy } : {})
              };
            } else {
              symbols.push({
                symbol: sym,
                addedAt: now,
                ...(e.lineType ? { lineType: e.lineType } : {}),
                ...(e.strategy ? { strategy: e.strategy } : {})
              });
            }
          }
        }
        return {
          name: "DefaultWatchlist",
          symbols,
          portfolioId,
          userId: ctx.userId,
          riskProfile,
          outlook
        } as never;
      }
    );
    repositoryMocks.listScheduledTasks.mockResolvedValue([
      { name: "Daily Sync", category: "sync-broker", enabled: true, scheduleCron: "0 2 * * *" }
    ]);
    repositoryMocks.listTaskRuns.mockResolvedValue([
      { taskName: "Daily Sync", status: "success", triggeredBy: "admin", durationMs: 250 }
    ]);
    marketDataMocks.getYahooMarketQuote.mockResolvedValue({
      symbol: "TSLA",
      price: 250.12,
      source: "yahoo-finance2",
      disclaimer: "market disclaimer"
    });
    optionsActionScanMocks.buildOptionsActionReport.mockResolvedValue({
      planTier: "premium_plus",
      truncated: false,
      generatedAt: "2026-04-25T00:00:00.000Z",
      disclaimer: "Not financial advice.",
      rows: [
        {
          source: "holding",
          symbol: "TSLA",
          strike: 250,
          exp: "2026-05-01",
          type: "call",
          qty: -1,
          recommendedAction: "ROLL",
          why: "Assignment risk elevated.",
          urgency: "high",
          targetWindow: "this week",
          confidence: "high"
        }
      ],
      asMarkdown: "### Options action scan"
    });
    nlPriceAlertMocks.listActivePortfolioPriceAlertsForUser.mockResolvedValue([]);
    nlPriceAlertMocks.countActivePortfolioPriceAlertsForTenant.mockResolvedValue(0);
    nlPriceAlertMocks.migrateLegacyNlPriceAlertsIfNeeded.mockResolvedValue(undefined);
    nlPriceAlertMocks.ensureUserAlertManagerScheduledTaskForTenant.mockResolvedValue(undefined);
    nlPriceAlertMocks.upsertActivePortfolioPriceAlert.mockReset();
    resolvePortfolioHintMock.mockReset();
  });

  it("portfolio_summary returns portfolio with accounts", async () => {
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", { operation: "portfolio_summary" });
    const data = JSON.parse(result.result);
    expect(data.name).toBe("Default Portfolio");
    expect(data.accountCount).toBe(1);
    expect(data.totalPositionCount).toBe(1);
    expect(data.accounts[0].type).toBe("fidelity");
    expect(data.accounts[0].cashBalance).toBe(25_000);
    expect(data.accounts[0].positionCount).toBe(1);
    expect(data.watchlist).toMatchObject({
      name: "DefaultWatchlist",
      symbolCount: 1,
      symbols: [
        {
          symbol: "TSLA",
          addedAt: expect.any(String),
          spotPriceDisplay: "$250.12",
          targetEntryNotional100xUsdDisplay: "$25,012",
          targetEntryNotional100xDisplay: "25,012"
        }
      ]
    });
    expect(result.error).toBeUndefined();
  });

  it("portfolio_summary includes watchlist error when no watchlist document", async () => {
    repositoryMocks.getUserWatchlist.mockResolvedValue(null);
    repositoryMocks.ensurePortfolioWatchlistForUser.mockResolvedValue(null);
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", { operation: "portfolio_summary" });
    const data = JSON.parse(result.result);
    expect(data.watchlist).toEqual({ error: "no_watchlist" });
    expect(data.accountCount).toBe(1);
  });

  it("portfolio_summary coalesces missing cashBalance to 25_000", async () => {
    repositoryMocks.listPortfolioAccounts.mockResolvedValueOnce([
      {
        _id: accountId,
        name: "Default Account",
        type: "fidelity",
        extAccountId: "ext_account_xref",
        isDefault: true
      }
    ]);
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", { operation: "portfolio_summary" });
    const data = JSON.parse(result.result);
    expect(data.accounts[0].cashBalance).toBe(25_000);
    expect(data.watchlist).toMatchObject({
      name: "DefaultWatchlist",
      symbolCount: 1
    });
  });

  it("watchlist_snapshot JSON stays parseable when symbols carry long desk rationale (no 8KB truncate)", async () => {
    const longRationale = "x".repeat(600);
    const symbols = Array.from({ length: 24 }, (_, i) => ({
      symbol: `SYM${i}`,
      addedAt: new Date(),
      rationale: longRationale
    }));
    repositoryMocks.getPortfolioWatchlist.mockResolvedValueOnce({
      name: "Large Watchlist",
      symbols
    });
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", { operation: "watchlist_snapshot" });
    expect(() => JSON.parse(result.result)).not.toThrow();
    const data = JSON.parse(result.result) as { symbolCount?: number };
    expect(data.symbolCount).toBe(24);
    expect(result.result.length).toBeGreaterThan(8 * 1024);
    expect(result.result).not.toContain("[truncated]");
  });

  it("watchlist_snapshot returns symbols with spot, notional USD, and desk entry price", async () => {
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", { operation: "watchlist_snapshot" });
    const data = JSON.parse(result.result);
    expect(data.name).toBe("DefaultWatchlist");
    expect(data.symbols).toEqual([
      {
        symbol: "TSLA",
        addedAt: expect.any(String),
        addedAtDisplay: expect.any(String),
        spotPriceDisplay: "$250.12",
        targetEntryNotional100xUsdDisplay: "$25,012",
        entryPrice: 240.5,
        targetEntryPrice: 240.5,
        targetEntryDisplay: "$240.50",
        targetEntryNotional100xDisplay: "25,012"
      }
    ]);
    expect(data.symbolCount).toBe(1);
  });

  it("account_health returns account list", async () => {
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", { operation: "account_health" });
    const data = JSON.parse(result.result);
    expect(data.accountCount).toBe(1);
    expect(data.accounts[0].name).toBe("Default Account");
    expect(data.accounts[0].cashBalance).toBe(25_000);
    expect(data.defaultAccountName).toBe("Default Account");
  });

  it("positions_snapshot returns holdings grouped by account", async () => {
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", { operation: "positions_snapshot" });
    const data = JSON.parse(result.result);
    expect(data.portfolioName).toBe("Default Portfolio");
    expect(data.totalPositionsAvailable).toBe(1);
    expect(data.totalPositionsReturned).toBe(1);
    expect(data.truncated).toBe(false);
    expect(data.accounts[0].positions[0]).toMatchObject({
      symbol: "TSLA",
      qty: 10,
      avgCost: 200
    });
  });

  it("positions_snapshot truncates when over cap", async () => {
    const many = Array.from({ length: 250 }, (_, i) => ({
      symbol: `S${i}`,
      qty: 1,
      avgCost: 1,
      accountId,
      portfolioId,
      userId: "user_123"
    }));
    repositoryMocks.listPortfolioPositionsByAccount.mockResolvedValueOnce(many);
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", { operation: "positions_snapshot" });
    const data = JSON.parse(result.result);
    expect(data.truncated).toBe(true);
    expect(data.totalPositionsReturned).toBe(200);
    expect(data.totalPositionsAvailable).toBe(250);
    expect(data.omittedCount).toBe(50);
  });

  it("task_status returns tasks and runs", async () => {
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", { operation: "task_status" });
    const data = JSON.parse(result.result);
    expect(data.taskCount).toBe(1);
    expect(data.tasks[0].name).toBe("Daily Sync");
    expect(data.recentRunCount).toBe(1);
    expect(data.recentRuns[0].status).toBe("success");
  });

  it("unknown operation returns error", async () => {
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", { operation: "delete_everything" });
    const data = JSON.parse(result.result);
    expect(data.error).toBe("unknown_operation");
    expect(result.error).toContain("unknown_operation");
  });

  it("returns error when no default portfolio and provision fails", async () => {
    repositoryMocks.getDefaultPortfolio.mockResolvedValueOnce(null);
    repositoryMocks.provisionDefaultPortfolioForUser.mockRejectedValueOnce(
      new Error("provision failed")
    );
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", { operation: "portfolio_summary" });
    const data = JSON.parse(result.result);
    expect(data.error).toBe("no_default_portfolio");
  });

  it("provisions default portfolio when missing then returns summary", async () => {
    repositoryMocks.getDefaultPortfolio.mockResolvedValueOnce(null);
    repositoryMocks.provisionDefaultPortfolioForUser.mockResolvedValueOnce({
      portfolio: { _id: portfolioId, name: "Provisioned", isDefault: true },
      account: { _id: accountId },
      watchlist: { _id: new ObjectId() }
    } as never);
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", { operation: "portfolio_summary" });
    const data = JSON.parse(result.result);
    expect(repositoryMocks.provisionDefaultPortfolioForUser).toHaveBeenCalledWith({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      watchlistSymbols: ["TSLA"]
    });
    expect(data.name).toBe("Provisioned");
    expect(data.accountCount).toBe(1);
  });

  it("returns error when no watchlist exists", async () => {
    repositoryMocks.getUserWatchlist.mockResolvedValue(null);
    repositoryMocks.ensurePortfolioWatchlistForUser.mockResolvedValue(null);
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", { operation: "watchlist_snapshot" });
    const data = JSON.parse(result.result);
    expect(data.error).toBe("no_watchlist");
  });

  it("ATXFINANCE_TOOL_DEFINITION has correct function schema", () => {
    expect(ATXFINANCE_TOOL_DEFINITION.type).toBe("function");
    expect(ATXFINANCE_TOOL_DEFINITION.function.name).toBe("atx_function");
    expect(ATXFINANCE_TOOL_DEFINITION.function.parameters.properties.operation.enum).toEqual([
      "portfolio_summary",
      "user_workspace_summary",
      "positions_snapshot",
      "watchlist_snapshot",
      "watchlist_add_symbols",
      "watchlist_remove_symbols",
      "account_health",
      "task_status",
      "options_scan",
      "options_action_scan",
      "strategy_recommendations",
      "monte_carlo_tail_risk",
      "market_quote",
      "price_alert_manage"
    ]);
  });

  it("price_alert_manage add (xChat atx_function) upserts NL rule for Premium+ advisor", async () => {
    resolvePortfolioHintMock.mockResolvedValue({
      ok: true,
      portfolioIdHex: portfolioId.toHexString(),
      portfolioName: "Default Portfolio"
    });
    const ruleId = new ObjectId();
    nlPriceAlertMocks.upsertActivePortfolioPriceAlert.mockResolvedValue({
      doc: { _id: ruleId },
      replaced: false
    });
    const executor = createXfinanceToolExecutor({
      ...ctx,
      tenantId: "507f1f77bcf86cd799439022",
      subscriptionPlan: "premium_plus",
      platformRoles: ["advisor"],
      workspacePortfolioId: portfolioId.toHexString()
    });
    const result = await executor("atx_function", {
      operation: "price_alert_manage",
      priceAlertOp: "add",
      symbol: "TSLA",
      targetPrice: 420,
      ruleKind: "above"
    });
    const data = JSON.parse(result.result) as {
      ok?: boolean;
      symbol?: string;
      targetPriceUsd?: number;
      ruleKind?: string;
      error?: string;
    };
    expect(data.error).toBeUndefined();
    expect(data.ok).toBe(true);
    expect(data.symbol).toBe("TSLA");
    expect(data.targetPriceUsd).toBe(420);
    expect(data.ruleKind).toBe("above");
    expect(nlPriceAlertMocks.upsertActivePortfolioPriceAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ctx.userId,
        tenantId: "507f1f77bcf86cd799439022",
        portfolioIdHex: portfolioId.toHexString(),
        symbolUpper: "TSLA",
        targetPriceUsd: 420,
        ruleKind: "above"
      })
    );
  });

  it("options_action_scan returns deterministic report payload", async () => {
    const executor = createXfinanceToolExecutor({
      ...ctx,
      subscriptionPlan: "premium_plus",
      workspacePortfolioId: portfolioId.toHexString()
    });
    const result = await executor("atx_function", { operation: "options_action_scan" });
    const data = JSON.parse(result.result) as {
      rowCount: number;
      rows: Array<{ symbol: string; recommendedAction: string }>;
      disclaimer: string;
    };
    expect(optionsActionScanMocks.buildOptionsActionReport).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        subscriptionPlan: "premium_plus",
        workspacePortfolioId: portfolioId.toHexString()
      })
    );
    expect(data.rowCount).toBe(1);
    expect(data.rows[0]).toMatchObject({
      symbol: "TSLA",
      recommendedAction: "ROLL"
    });
    expect(data.disclaimer).toContain("Not financial advice");
  });

  it("watchlist_add_symbols calls mutatePortfolioWatchlistSymbols with addEntries and desk defaults when unset", async () => {
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", {
      operation: "watchlist_add_symbols",
      symbol: "NVDA"
    });
    const data = JSON.parse(result.result);
    expect(data.ok).toBe(true);
    expect(data.requested).toEqual(["NVDA"]);
    expect(data.addedNew).toEqual(["NVDA"]);
    expect(repositoryMocks.ensurePortfolioWatchlistForUser).toHaveBeenCalled();
    expect(repositoryMocks.mutatePortfolioWatchlistSymbols).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ctx.userId,
        portfolioId: portfolioId.toHexString(),
        tenantId: ctx.tenantId,
        addEntries: [
          {
            symbol: "NVDA",
            lineType: "Stock",
            strategy: "balanced"
          }
        ],
        riskProfile: "growth",
        outlook: "neutral"
      })
    );
  });

  it("watchlist_add_symbols accepts symbols array", async () => {
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", {
      operation: "watchlist_add_symbols",
      symbols: ["NVDA", "AMD"]
    });
    const data = JSON.parse(result.result);
    expect(data.ok).toBe(true);
    expect(data.requested).toEqual(["NVDA", "AMD"]);
  });

  it("watchlist_add_symbols returns no_symbols when missing tickers", async () => {
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", { operation: "watchlist_add_symbols" });
    const data = JSON.parse(result.result);
    expect(data.error).toBe("no_symbols");
    expect(repositoryMocks.mutatePortfolioWatchlistSymbols).not.toHaveBeenCalled();
  });

  it("watchlist_remove_symbols removes tickers", async () => {
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", {
      operation: "watchlist_remove_symbols",
      symbol: "TSLA"
    });
    const data = JSON.parse(result.result);
    expect(data.ok).toBe(true);
    expect(data.removed).toEqual(["TSLA"]);
    expect(repositoryMocks.mutatePortfolioWatchlistSymbols).toHaveBeenCalledWith(
      expect.objectContaining({ removeSymbols: ["TSLA"] })
    );
  });

  it("market_quote returns provider-backed quote snapshot with numeric price for assistant prose", async () => {
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", {
      operation: "market_quote",
      symbol: "tsla"
    });
    const data = JSON.parse(result.result) as {
      symbol: string;
      price?: number;
      source: string;
      disclaimer?: string;
    };
    expect(marketDataMocks.getYahooMarketQuote).toHaveBeenCalledWith({ symbol: "tsla" });
    expect(data.symbol).toBe("TSLA");
    expect(data.source).toBe("yahoo-finance2");
    expect(data.disclaimer).toBeDefined();
    expect(typeof data.price).toBe("number");
    expect(Number.isFinite(data.price)).toBe(true);
    expect(data.price).toBe(250.12);
  });

  it("yahoo_finance and atx_function market_quote return distinct SPY/QQQ prices in tool JSON", async () => {
    marketDataMocks.getYahooMarketQuote.mockImplementation(async (input: { symbol?: string }) => {
      const sym = (input.symbol ?? "TSLA").toUpperCase();
      const base = { source: "yahoo-finance2" as const, disclaimer: "market disclaimer" };
      if (sym === "SPY") {
        return { ...base, symbol: "SPY", price: 501.25, previousClose: 499.0, change: 2.25 };
      }
      if (sym === "QQQ") {
        return { ...base, symbol: "QQQ", price: 402.5, previousClose: 401.0, change: 1.5 };
      }
      return { ...base, symbol: sym, price: 1 };
    });
    const executor = createXfinanceToolExecutor(ctx);

    const yfSpy = await executor("yahoo_finance", { symbol: "SPY" });
    const yfQqq = await executor("yahoo_finance", { symbol: "QQQ" });
    const atxSpy = await executor("atx_function", { operation: "market_quote", symbol: "SPY" });
    const atxQqq = await executor("atx_function", { operation: "market_quote", symbol: "QQQ" });

    for (const [label, raw] of [
      ["yahoo_finance SPY", yfSpy.result],
      ["yahoo_finance QQQ", yfQqq.result],
      ["atx_function SPY", atxSpy.result],
      ["atx_function QQQ", atxQqq.result]
    ] as const) {
      const row = JSON.parse(raw) as { symbol: string; price?: number };
      expect(row.symbol, label).toMatch(/^(SPY|QQQ)$/);
      expect(typeof row.price, label).toBe("number");
      expect(Number.isFinite(row.price), label).toBe(true);
      expect(row.price, label).toBeGreaterThan(100);
    }

    expect(JSON.parse(yfSpy.result).price).toBe(501.25);
    expect(JSON.parse(yfQqq.result).price).toBe(402.5);
    expect(JSON.parse(atxSpy.result).price).toBe(501.25);
    expect(JSON.parse(atxQqq.result).price).toBe(402.5);
  });

  it("truncates output exceeding 8KB", async () => {
    repositoryMocks.listScheduledTasks.mockResolvedValueOnce(
      Array.from({ length: 500 }, (_, i) => ({
        name: `Task-${i}-${"x".repeat(100)}`,
        category: "sync-broker",
        enabled: true,
        scheduleCron: "0 * * * *"
      }))
    );
    repositoryMocks.listTaskRuns.mockResolvedValueOnce([]);

    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", { operation: "task_status" });
    const bytes = new TextEncoder().encode(result.result).length;
    expect(bytes).toBeLessThanOrEqual(8 * 1024 + 20);
    expect(result.result).toContain("[truncated]");
  });

  it("serves portfolio_summary from workspacePreload without Mongo list calls", async () => {
    const preload = {
      promptJson: {
        loadedAt: "2026-01-01T00:00:00.000Z",
        workspaceContentRev: 0,
        portfolio: {
          id: portfolioId.toHexString(),
          name: "PreloadP",
          isDefault: true,
          totalPositionCount: 3
        },
        accounts: [
          {
            accountId: accountId.toHexString(),
            name: "Default Account",
            type: "fidelity",
            extAccountId: "ext_account_xref",
            isDefault: true,
            cashBalance: 25_000,
            positionCount: 3
          }
        ],
        positionsPreview: [],
        positionsPreviewTruncated: false,
        positionsOmittedCount: 0,
        watchlist: {
          name: "DefaultWatchlist",
          riskProfile: null,
          outlook: null,
          symbols: [wlSymbolFixture("NVDA", "2026-01-02T00:00:00.000Z")]
        }
      },
      positionsFull: [
        { symbol: "TSLA", qty: 10, avgCost: 200, accountId: accountId.toHexString() },
        { symbol: "AMD", qty: 5, avgCost: 90, accountId: accountId.toHexString() },
        { symbol: "NVDA", qty: 2, avgCost: 400, accountId: accountId.toHexString() }
      ]
    };
    const executor = createXfinanceToolExecutor({
      ...ctx,
      workspacePreload: preload
    });
    const out = await executor("atx_function", { operation: "portfolio_summary" });
    const j = JSON.parse(out.result) as {
      name: string;
      totalPositionCount: number;
      watchlist: { name: string; symbolCount: number };
    };
    expect(j.name).toBe("PreloadP");
    expect(j.totalPositionCount).toBe(3);
    expect(j.watchlist).toMatchObject({ name: "DefaultWatchlist", symbolCount: 1 });
    expect(repositoryMocks.listPortfolioAccounts).not.toHaveBeenCalled();
    expect(repositoryMocks.listPortfolioPositionsByAccount).not.toHaveBeenCalled();
  });

  it("invalidates workspacePreload after watchlist_add_symbols so portfolio_summary hits Mongo", async () => {
    const preload = {
      promptJson: {
        loadedAt: "2026-01-01T00:00:00.000Z",
        workspaceContentRev: 0,
        portfolio: {
          id: portfolioId.toHexString(),
          name: "PreloadP",
          isDefault: true,
          totalPositionCount: 1
        },
        accounts: [
          {
            accountId: accountId.toHexString(),
            name: "Default Account",
            type: "fidelity",
            extAccountId: "ext_account_xref",
            isDefault: true,
            cashBalance: 25_000,
            positionCount: 1
          }
        ],
        positionsPreview: [],
        positionsPreviewTruncated: false,
        positionsOmittedCount: 0,
        watchlist: {
          name: "WL",
          riskProfile: null,
          outlook: null,
          symbols: [wlSymbolFixture("TSLA", "2026-01-02T00:00:00.000Z")]
        }
      },
      positionsFull: [{ symbol: "TSLA", qty: 10, avgCost: 200, accountId: accountId.toHexString() }]
    };
    const executor = createXfinanceToolExecutor({
      ...ctx,
      workspacePreload: preload
    });
    await executor("atx_function", { operation: "portfolio_summary" });
    expect(repositoryMocks.listPortfolioAccounts).not.toHaveBeenCalled();

    await executor("atx_function", { operation: "watchlist_add_symbols", symbols: ["AMD"] });

    repositoryMocks.listPortfolioAccounts.mockClear();
    await executor("atx_function", { operation: "portfolio_summary" });
    expect(repositoryMocks.listPortfolioAccounts).toHaveBeenCalled();
  });

  it("workspaceLazyLoad: loads snapshot once on first short-circuit op and reuses it", async () => {
    const preload = {
      promptJson: {
        loadedAt: "2026-01-01T00:00:00.000Z",
        workspaceContentRev: 0,
        portfolio: {
          id: portfolioId.toHexString(),
          name: "LazyP",
          isDefault: true,
          totalPositionCount: 2
        },
        accounts: [
          {
            accountId: accountId.toHexString(),
            name: "Default Account",
            type: "fidelity",
            extAccountId: "ext_account_xref",
            isDefault: true,
            cashBalance: 25_000,
            positionCount: 2
          }
        ],
        positionsPreview: [],
        positionsPreviewTruncated: false,
        positionsOmittedCount: 0,
        watchlist: {
          name: "WL",
          riskProfile: null,
          outlook: null,
          symbols: [wlSymbolFixture("TSLA", "2026-01-02T00:00:00.000Z")]
        }
      },
      positionsFull: [
        { symbol: "TSLA", qty: 10, avgCost: 200, accountId: accountId.toHexString() },
        { symbol: "AMD", qty: 5, avgCost: 90, accountId: accountId.toHexString() }
      ]
    };
    workspaceLoadMocks.loadWorkspaceSnapshotPreload.mockResolvedValue(preload);
    const executor = createXfinanceToolExecutor({
      ...ctx,
      workspaceLazyLoad: { userId: ctx.userId, tenantId: ctx.tenantId }
    });
    const out1 = await executor("atx_function", { operation: "portfolio_summary" });
    expect(workspaceLoadMocks.loadWorkspaceSnapshotPreload).toHaveBeenCalledTimes(1);
    expect(workspaceLoadMocks.loadWorkspaceSnapshotPreload).toHaveBeenCalledWith({
      userId: ctx.userId,
      tenantId: ctx.tenantId
    });
    expect(repositoryMocks.listPortfolioAccounts).not.toHaveBeenCalled();
    const j1 = JSON.parse(out1.result) as { name: string };
    expect(j1.name).toBe("LazyP");

    workspaceLoadMocks.loadWorkspaceSnapshotPreload.mockClear();
    const out2 = await executor("atx_function", { operation: "portfolio_summary" });
    expect(workspaceLoadMocks.loadWorkspaceSnapshotPreload).not.toHaveBeenCalled();
    const j2 = JSON.parse(out2.result) as { name: string };
    expect(j2.name).toBe("LazyP");
  });

  it("workspaceLazyLoad: does not load snapshot for market_quote before a short-circuit op", async () => {
    marketDataMocks.getYahooMarketQuote.mockResolvedValueOnce({
      symbol: "SPY",
      price: 500,
      source: "yahoo-finance2",
      disclaimer: "market disclaimer"
    });
    const executor = createXfinanceToolExecutor({
      ...ctx,
      workspaceLazyLoad: { userId: ctx.userId, tenantId: ctx.tenantId }
    });
    await executor("atx_function", { operation: "market_quote", symbol: "SPY" });
    expect(workspaceLoadMocks.loadWorkspaceSnapshotPreload).not.toHaveBeenCalled();
  });

  it("workspaceLazyLoad: invalidates after watchlist_add_symbols so next portfolio_summary hits Mongo", async () => {
    const preload = {
      promptJson: {
        loadedAt: "2026-01-01T00:00:00.000Z",
        workspaceContentRev: 0,
        portfolio: {
          id: portfolioId.toHexString(),
          name: "LazyP",
          isDefault: true,
          totalPositionCount: 1
        },
        accounts: [
          {
            accountId: accountId.toHexString(),
            name: "Default Account",
            type: "fidelity",
            extAccountId: "ext_account_xref",
            isDefault: true,
            cashBalance: 25_000,
            positionCount: 1
          }
        ],
        positionsPreview: [],
        positionsPreviewTruncated: false,
        positionsOmittedCount: 0,
        watchlist: {
          name: "WL",
          riskProfile: null,
          outlook: null,
          symbols: [wlSymbolFixture("TSLA", "2026-01-02T00:00:00.000Z")]
        }
      },
      positionsFull: [{ symbol: "TSLA", qty: 10, avgCost: 200, accountId: accountId.toHexString() }]
    };
    workspaceLoadMocks.loadWorkspaceSnapshotPreload.mockResolvedValue(preload);
    const executor = createXfinanceToolExecutor({
      ...ctx,
      workspaceLazyLoad: { userId: ctx.userId, tenantId: ctx.tenantId }
    });
    await executor("atx_function", { operation: "portfolio_summary" });
    expect(workspaceLoadMocks.loadWorkspaceSnapshotPreload).toHaveBeenCalledTimes(1);
    expect(repositoryMocks.listPortfolioAccounts).not.toHaveBeenCalled();

    await executor("atx_function", { operation: "watchlist_add_symbols", symbols: ["AMD"] });

    repositoryMocks.listPortfolioAccounts.mockClear();
    await executor("atx_function", { operation: "portfolio_summary" });
    expect(repositoryMocks.listPortfolioAccounts).toHaveBeenCalled();
    expect(workspaceLoadMocks.loadWorkspaceSnapshotPreload).toHaveBeenCalledTimes(1);
  });
});
