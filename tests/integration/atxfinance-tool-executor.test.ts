import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  DEFAULT_ACCOUNT_CASH_BALANCE: 25_000,
  DEFAULT_EXT_BROKER_REF: "extBrokerName",
  getDefaultPortfolio: vi.fn(),
  provisionDefaultPortfolioForUser: vi.fn(),
  listPortfolioAccounts: vi.fn(),
  listPortfolioPositionsByAccount: vi.fn(),
  getPortfolioWatchlist: vi.fn(),
  mutatePortfolioWatchlistSymbols: vi.fn(),
  listScheduledTasks: vi.fn(),
  listTaskRuns: vi.fn()
}));

const marketDataMocks = vi.hoisted(() => ({
  getYahooMarketQuote: vi.fn()
}));

vi.mock("@/modules/core-admin/repository", () => repositoryMocks);
vi.mock("@/modules/xchat/market-data", () => marketDataMocks);
vi.mock("@/modules/xchat/tool-cache", () => ({
  getCachedToolResult: () => null,
  setCachedToolResult: () => undefined,
  deleteCachedToolResult: vi.fn()
}));

import {
    ATXFINANCE_TOOL_DEFINITION,
    createXfinanceToolExecutor
} from "@/modules/xchat/tool-executor";

describe("atxfinance tool executor", () => {
  const ctx = { userId: "user_123", tenantId: "tenant_456" };
  const portfolioId = new ObjectId();
  const accountId = new ObjectId();

  beforeEach(() => {
    repositoryMocks.getDefaultPortfolio.mockResolvedValue({
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
      symbols: [{ symbol: "TSLA", addedAt: new Date() }]
    });
    repositoryMocks.mutatePortfolioWatchlistSymbols.mockImplementation(
      async ({ addSymbols, removeSymbols }) => {
        let symbols = [{ symbol: "TSLA", addedAt: new Date() }];
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
        return {
          name: "DefaultWatchlist",
          symbols,
          portfolioId,
          userId: ctx.userId
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
  });

  it("portfolio_summary returns portfolio with accounts", async () => {
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", { operation: "portfolio_summary" });
    const data = JSON.parse(result.result);
    expect(data.name).toBe("Default Portfolio");
    expect(data.ext_broker_ref).toBe("extBrokerName");
    expect(data.accountCount).toBe(1);
    expect(data.totalPositionCount).toBe(1);
    expect(data.accounts[0].type).toBe("fidelity");
    expect(data.accounts[0].cashBalance).toBe(25_000);
    expect(data.accounts[0].positionCount).toBe(1);
    expect(result.error).toBeUndefined();
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
  });

  it("watchlist_snapshot returns symbols with addedAt", async () => {
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", { operation: "watchlist_snapshot" });
    const data = JSON.parse(result.result);
    expect(data.name).toBe("DefaultWatchlist");
    expect(data.symbols).toEqual([{ symbol: "TSLA", addedAt: expect.any(String) }]);
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
    repositoryMocks.getPortfolioWatchlist.mockResolvedValueOnce(null);
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", { operation: "watchlist_snapshot" });
    const data = JSON.parse(result.result);
    expect(data.error).toBe("no_watchlist");
  });

  it("ATXFINANCE_TOOL_DEFINITION has correct function schema", () => {
    expect(ATXFINANCE_TOOL_DEFINITION.type).toBe("function");
    expect(ATXFINANCE_TOOL_DEFINITION.function.name).toBe("atxfinance");
    expect(ATXFINANCE_TOOL_DEFINITION.function.parameters.properties.operation.enum).toEqual([
      "portfolio_summary",
      "positions_snapshot",
      "watchlist_snapshot",
      "watchlist_add_symbols",
      "watchlist_remove_symbols",
      "account_health",
      "task_status",
      "market_quote"
    ]);
  });

  it("watchlist_add_symbols calls mutatePortfolioWatchlistSymbols", async () => {
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", {
      operation: "watchlist_add_symbols",
      symbol: "NVDA"
    });
    const data = JSON.parse(result.result);
    expect(data.ok).toBe(true);
    expect(data.requested).toEqual(["NVDA"]);
    expect(repositoryMocks.mutatePortfolioWatchlistSymbols).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ctx.userId,
        portfolioId: portfolioId.toHexString(),
        tenantId: ctx.tenantId,
        addSymbols: ["NVDA"]
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

  it("market_quote returns provider-backed quote snapshot", async () => {
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", {
      operation: "market_quote",
      symbol: "tsla"
    });
    const data = JSON.parse(result.result);
    expect(marketDataMocks.getYahooMarketQuote).toHaveBeenCalledWith({ symbol: "tsla" });
    expect(data.symbol).toBe("TSLA");
    expect(data.source).toBe("yahoo-finance2");
    expect(data.disclaimer).toBeDefined();
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
});
