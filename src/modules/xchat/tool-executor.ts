import type { ToolExecutor } from "@/lib/xai";
import {
    DEFAULT_ACCOUNT_CASH_BALANCE,
    DEFAULT_EXT_BROKER_REF,
    getDefaultPortfolio,
    getPortfolioWatchlist,
    listPortfolioAccounts,
    listPortfolioPositionsByAccount,
    listScheduledTasks,
    listTaskRuns,
    mutatePortfolioWatchlistSymbols,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import { getYahooMarketQuote } from "@/modules/xchat/market-data";
import {
    deleteCachedToolResult,
    getCachedToolResult,
    setCachedToolResult
} from "@/modules/xchat/tool-cache";

const MAX_OUTPUT_BYTES = 8 * 1024;
/** Cap rows returned by positions_snapshot before JSON serialization (freshness; not cached). */
const MAX_POSITIONS_RETURNED = 200;
const CACHEABLE_OPERATIONS = new Set(["portfolio_summary", "watchlist_snapshot", "account_health"]);
/** Matches PATCH `/api/portfolios/:id/watchlist` batch size. */
const MAX_WATCHLIST_MUTATE_PER_CALL = 20;

function parseTickerListFromArgs(args: Record<string, unknown>, max: number): string[] {
  if (Array.isArray(args.symbols)) {
    const out: string[] = [];
    for (const item of args.symbols) {
      if (typeof item !== "string") {
        continue;
      }
      const t = item.trim().toUpperCase();
      if (t && /^[A-Z0-9.\-]{1,32}$/.test(t)) {
        out.push(t);
      }
      if (out.length >= max) {
        break;
      }
    }
    return out;
  }
  if (typeof args.symbol === "string") {
    const t = args.symbol.trim().toUpperCase();
    if (t && /^[A-Z0-9.\-]{1,32}$/.test(t)) {
      return [t].slice(0, max);
    }
  }
  return [];
}

type ExecutorContext = {
  userId: string;
  tenantId?: string;
};

async function getDefaultPortfolioOrProvision(
  ctx: ExecutorContext
): Promise<Awaited<ReturnType<typeof getDefaultPortfolio>>> {
  const existing = await getDefaultPortfolio(ctx.userId, { tenantId: ctx.tenantId });
  if (existing?._id) {
    return existing;
  }
  try {
    const { portfolio } = await provisionDefaultPortfolioForUser({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      watchlistSymbols: ["TSLA"]
    });
    return portfolio;
  } catch {
    return null;
  }
}

type OperationHandler = (
  args: Record<string, unknown>,
  ctx: ExecutorContext
) => Promise<unknown>;

function positionCountsByAccountId(
  positions: Array<{ accountId: { toHexString: () => string } }>
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of positions) {
    const id = p.accountId.toHexString();
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

const operations: Record<string, OperationHandler> = {
  portfolio_summary: async (_args, ctx) => {
    const portfolio = await getDefaultPortfolioOrProvision(ctx);
    if (!portfolio?._id) {
      return { error: "no_default_portfolio" };
    }

    const portfolioId = portfolio._id.toHexString();
    const accounts = await listPortfolioAccounts({
      userId: ctx.userId,
      portfolioId,
      tenantId: ctx.tenantId
    });

    const accountIds = accounts
      .map((a) => a._id)
      .filter((id): id is NonNullable<(typeof accounts)[0]["_id"]> => Boolean(id));
    const positions =
      accountIds.length > 0
        ? await listPortfolioPositionsByAccount({
            userId: ctx.userId,
            portfolioId,
            accountIds,
            tenantId: ctx.tenantId
          })
        : [];
    const counts = positionCountsByAccountId(positions);

    return {
      name: portfolio.name,
      isDefault: portfolio.isDefault,
      ext_broker_ref: portfolio.ext_broker_ref ?? DEFAULT_EXT_BROKER_REF,
      accountCount: accounts.length,
      totalPositionCount: positions.length,
      accounts: accounts.map((a) => ({
        name: a.name,
        type: a.type,
        extAccountId: a.extAccountId,
        isDefault: a.isDefault,
        cashBalance: a.cashBalance ?? DEFAULT_ACCOUNT_CASH_BALANCE,
        positionCount: a._id ? (counts.get(a._id.toHexString()) ?? 0) : 0
      }))
    };
  },

  watchlist_snapshot: async (_args, ctx) => {
    const portfolio = await getDefaultPortfolioOrProvision(ctx);
    if (!portfolio?._id) {
      return { error: "no_default_portfolio" };
    }

    const watchlist = await getPortfolioWatchlist({
      userId: ctx.userId,
      portfolioId: portfolio._id.toHexString(),
      tenantId: ctx.tenantId
    });
    if (!watchlist) {
      return { error: "no_watchlist" };
    }

    const symbols = watchlist.symbols ?? [];
    return {
      name: watchlist.name,
      symbolCount: symbols.length,
      symbols: symbols.map((s) => ({
        symbol: s.symbol,
        addedAt:
          s.addedAt instanceof Date ? s.addedAt.toISOString() : String(s.addedAt)
      }))
    };
  },

  watchlist_add_symbols: async (args, ctx) => {
    const toAdd = parseTickerListFromArgs(args, MAX_WATCHLIST_MUTATE_PER_CALL);
    if (toAdd.length === 0) {
      return {
        error: "no_symbols",
        hint: "Provide symbols (string array) or symbol (string), e.g. NVDA or [\"NVDA\",\"AMD\"]."
      };
    }
    const portfolio = await getDefaultPortfolioOrProvision(ctx);
    if (!portfolio?._id) {
      return { error: "no_default_portfolio" };
    }
    const updated = await mutatePortfolioWatchlistSymbols({
      userId: ctx.userId,
      portfolioId: portfolio._id.toHexString(),
      tenantId: ctx.tenantId,
      addSymbols: toAdd
    });
    deleteCachedToolResult(ctx.userId, "watchlist_snapshot");
    if (!updated) {
      return { error: "no_watchlist" };
    }
    const symbols = updated.symbols ?? [];
    return {
      ok: true,
      requested: toAdd,
      watchlistName: updated.name,
      symbolCount: symbols.length,
      symbols: symbols.map((s) => ({
        symbol: s.symbol,
        addedAt: s.addedAt instanceof Date ? s.addedAt.toISOString() : String(s.addedAt)
      }))
    };
  },

  watchlist_remove_symbols: async (args, ctx) => {
    const toRemove = parseTickerListFromArgs(args, MAX_WATCHLIST_MUTATE_PER_CALL);
    if (toRemove.length === 0) {
      return {
        error: "no_symbols",
        hint: "Provide symbols (string array) or symbol (string) to remove from the default watchlist."
      };
    }
    const portfolio = await getDefaultPortfolioOrProvision(ctx);
    if (!portfolio?._id) {
      return { error: "no_default_portfolio" };
    }
    const updated = await mutatePortfolioWatchlistSymbols({
      userId: ctx.userId,
      portfolioId: portfolio._id.toHexString(),
      tenantId: ctx.tenantId,
      removeSymbols: toRemove
    });
    deleteCachedToolResult(ctx.userId, "watchlist_snapshot");
    if (!updated) {
      return { error: "no_watchlist" };
    }
    const symbols = updated.symbols ?? [];
    return {
      ok: true,
      removed: toRemove,
      watchlistName: updated.name,
      symbolCount: symbols.length,
      symbols: symbols.map((s) => ({
        symbol: s.symbol,
        addedAt: s.addedAt instanceof Date ? s.addedAt.toISOString() : String(s.addedAt)
      }))
    };
  },

  account_health: async (_args, ctx) => {
    const portfolio = await getDefaultPortfolioOrProvision(ctx);
    if (!portfolio?._id) {
      return { error: "no_default_portfolio" };
    }

    const accounts = await listPortfolioAccounts({
      userId: ctx.userId,
      portfolioId: portfolio._id.toHexString(),
      tenantId: ctx.tenantId
    });

    const defaultAccount = accounts.find((a) => a.isDefault);

    return {
      accountCount: accounts.length,
      accounts: accounts.map((a) => ({
        name: a.name,
        type: a.type,
        extAccountId: a.extAccountId,
        isDefault: a.isDefault,
        cashBalance: a.cashBalance ?? DEFAULT_ACCOUNT_CASH_BALANCE
      })),
      defaultAccountName: defaultAccount?.name
    };
  },

  positions_snapshot: async (_args, ctx) => {
    const portfolio = await getDefaultPortfolioOrProvision(ctx);
    if (!portfolio?._id) {
      return { error: "no_default_portfolio" };
    }

    const portfolioId = portfolio._id.toHexString();
    const accounts = await listPortfolioAccounts({
      userId: ctx.userId,
      portfolioId,
      tenantId: ctx.tenantId
    });
    const accountIds = accounts
      .map((a) => a._id)
      .filter((id): id is NonNullable<(typeof accounts)[0]["_id"]> => Boolean(id));

    if (accountIds.length === 0) {
      return {
        portfolioName: portfolio.name,
        accounts: [],
        totalPositionsReturned: 0,
        totalPositionsAvailable: 0,
        truncated: false
      };
    }

    const allPositions = await listPortfolioPositionsByAccount({
      userId: ctx.userId,
      portfolioId,
      accountIds,
      tenantId: ctx.tenantId
    });

    const totalAvailable = allPositions.length;
    const truncated = totalAvailable > MAX_POSITIONS_RETURNED;
    const sliced = allPositions.slice(0, MAX_POSITIONS_RETURNED);

    const byAccountHex = new Map<string, typeof sliced>();
    for (const p of sliced) {
      const hex = p.accountId.toHexString();
      const list = byAccountHex.get(hex) ?? [];
      list.push(p);
      byAccountHex.set(hex, list);
    }

    const accountsWithPositions = accounts
      .filter((a) => a._id)
      .map((a) => {
        const hex = a._id!.toHexString();
        const rows = byAccountHex.get(hex) ?? [];
        return {
          name: a.name,
          isDefault: a.isDefault,
          positions: rows.map((p) => ({
            symbol: p.symbol,
            qty: p.qty,
            avgCost: p.avgCost
          }))
        };
      });

    return {
      portfolioName: portfolio.name,
      accounts: accountsWithPositions,
      totalPositionsReturned: sliced.length,
      totalPositionsAvailable: totalAvailable,
      truncated,
      ...(truncated
        ? { omittedCount: totalAvailable - sliced.length }
        : {})
    };
  },

  task_status: async (_args, ctx) => {
    const tasks = await listScheduledTasks({
      tenantId: ctx.tenantId,
      limit: 20
    });
    const runs = await listTaskRuns({
      tenantId: ctx.tenantId,
      limit: 10
    });

    return {
      taskCount: tasks.length,
      tasks: tasks.map((t) => ({
        name: t.name,
        category: t.category,
        enabled: t.enabled,
        scheduleCron: t.scheduleCron
      })),
      recentRunCount: runs.length,
      recentRuns: runs.map((r) => ({
        taskName: r.taskName,
        status: r.status,
        triggeredBy: r.triggeredBy,
        durationMs: r.durationMs
      }))
    };
  },

  market_quote: async (args, ctx: ExecutorContext) => {
    void ctx;
    const symbol = typeof args.symbol === "string" ? args.symbol : undefined;
    return getYahooMarketQuote({ symbol });
  }
};

function truncateOutput(output: string): string {
  const bytes = new TextEncoder().encode(output);
  if (bytes.length <= MAX_OUTPUT_BYTES) return output;
  const truncated = new TextDecoder().decode(bytes.slice(0, MAX_OUTPUT_BYTES));
  return truncated + "\n[truncated]";
}

export function createXfinanceToolExecutor(
  ctx: ExecutorContext
): ToolExecutor {
  return async (name: string, args: Record<string, unknown>) => {
    const operation =
      name === "yahoo_finance"
        ? "market_quote"
        : typeof args.operation === "string"
          ? args.operation
          : "";
    const handler = operations[operation];
    if (!handler) {
      return {
        result: JSON.stringify({ error: "unknown_operation", operation }),
        error: `unknown_operation: ${operation}`
      };
    }

    if (CACHEABLE_OPERATIONS.has(operation)) {
      const cached = getCachedToolResult(ctx.userId, operation);
      if (cached) {
        return { result: cached };
      }
    }

    const data = await handler(args, ctx);
    const serialized = JSON.stringify(data);
    const output = truncateOutput(serialized);

    if (CACHEABLE_OPERATIONS.has(operation)) {
      setCachedToolResult(ctx.userId, operation, output);
    }

    return { result: output };
  };
}

export const ATXFINANCE_TOOL_DEFINITION = {
  type: "function" as const,
  function: {
    name: "atxfinance",
    description:
      "Portfolio, accounts, watchlist (read + add/remove symbols on the user's default watchlist), positions, scheduled tasks, and Yahoo quotes. Scoped to the signed-in user only—never pass a user id. Use watchlist_add_symbols when the user asks to add tickers (e.g. \"add NVDA to my watchlist\"); use watchlist_remove_symbols to remove.",
    parameters: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: [
            "portfolio_summary",
            "positions_snapshot",
            "watchlist_snapshot",
            "watchlist_add_symbols",
            "watchlist_remove_symbols",
            "account_health",
            "task_status",
            "market_quote"
          ],
          description:
            "portfolio_summary: portfolio + accounts with cashBalance and position counts. positions_snapshot: holdings per account (qty, avgCost; capped). watchlist_snapshot: current symbols. watchlist_add_symbols / watchlist_remove_symbols: require symbols array or symbol (see properties). account_health: balances + default account. task_status: scheduled tasks/runs. market_quote: Yahoo quote for symbol."
        },
        symbol: {
          type: "string",
          description:
            "Single ticker: market_quote, or one symbol for watchlist_add_symbols / watchlist_remove_symbols."
        },
        symbols: {
          type: "array",
          items: { type: "string" },
          description:
            "Multiple tickers for watchlist_add_symbols or watchlist_remove_symbols (max 20 per call), e.g. [\"NVDA\",\"AMD\"]."
        }
      },
      required: ["operation"]
    }
  }
};

export const YAHOO_FINANCE_TOOL_DEFINITION = {
  type: "function" as const,
  function: {
    name: "yahoo_finance",
    description:
      "Fetch market quote data from Yahoo Finance (internal canonical market data source).",
    parameters: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Ticker symbol to quote (for example TSLA). Optional; defaults to TSLA."
        }
      }
    }
  }
};
