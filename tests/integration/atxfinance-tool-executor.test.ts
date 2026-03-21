import { describe, expect, it, vi, beforeEach } from "vitest";
import { ObjectId } from "mongodb";

const repositoryMocks = vi.hoisted(() => ({
  getDefaultPortfolio: vi.fn(),
  listPortfolioAccounts: vi.fn(),
  getPortfolioWatchlist: vi.fn(),
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
  setCachedToolResult: () => undefined
}));

import {
  createXfinanceToolExecutor,
  ATXFINANCE_TOOL_DEFINITION
} from "@/modules/xchat/tool-executor";

describe("atxfinance tool executor", () => {
  const ctx = { userId: "user_123", tenantId: "tenant_456" };
  const portfolioId = new ObjectId();

  beforeEach(() => {
    repositoryMocks.getDefaultPortfolio.mockResolvedValue({
      _id: portfolioId,
      name: "Default Portfolio",
      isDefault: true
    });
    repositoryMocks.listPortfolioAccounts.mockResolvedValue([
      {
        name: "Default Account",
        type: "fidelity",
        extAccountId: "fidelity-default-user_123",
        isDefault: true
      }
    ]);
    repositoryMocks.getPortfolioWatchlist.mockResolvedValue({
      name: "DefaultWatchlist",
      symbols: [{ symbol: "TSLA", addedAt: new Date() }]
    });
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
    expect(data.accountCount).toBe(1);
    expect(data.accounts[0].type).toBe("fidelity");
    expect(result.error).toBeUndefined();
  });

  it("watchlist_snapshot returns symbols", async () => {
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", { operation: "watchlist_snapshot" });
    const data = JSON.parse(result.result);
    expect(data.name).toBe("DefaultWatchlist");
    expect(data.symbols).toEqual(["TSLA"]);
    expect(data.symbolCount).toBe(1);
  });

  it("account_health returns account list", async () => {
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", { operation: "account_health" });
    const data = JSON.parse(result.result);
    expect(data.accountCount).toBe(1);
    expect(data.accounts[0].name).toBe("Default Account");
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

  it("returns error when no default portfolio exists", async () => {
    repositoryMocks.getDefaultPortfolio.mockResolvedValueOnce(null);
    const executor = createXfinanceToolExecutor(ctx);
    const result = await executor("atxfinance", { operation: "portfolio_summary" });
    const data = JSON.parse(result.result);
    expect(data.error).toBe("no_default_portfolio");
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
      "watchlist_snapshot",
      "account_health",
      "task_status",
      "market_quote"
    ]);
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
