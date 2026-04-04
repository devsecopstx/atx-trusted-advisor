import type { ToolExecutor } from "@/lib/xai";
import {
    DEFAULT_ACCOUNT_CASH_BALANCE,
    ensurePortfolioWatchlistForUser,
    getDefaultPortfolio,
    getPortfolioWatchlist,
    listPortfolioAccounts,
    listPortfolioPositionsByAccount,
    listScheduledTasks,
    listTaskRuns,
    mutatePortfolioWatchlistSymbols,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import type { AccountOutlook, WatchlistSymbol } from "@/modules/core-admin/types";
import { parseAccountOutlook } from "@/modules/core-admin/types";
import {
    WATCHLIST_ENTRY_DEFAULT_LINE_TYPE,
    WATCHLIST_ENTRY_DEFAULT_STRATEGY,
    WATCHLIST_UPSERT_DEFAULT_OUTLOOK,
    WATCHLIST_UPSERT_DEFAULT_RISK_PROFILE
} from "@/modules/watchlist/default-upsert-fields";
import { getYahooMarketQuote } from "@/modules/xchat/market-data";
import {
    deleteCachedToolResult,
    getCachedToolResult,
    setCachedToolResult
} from "@/modules/xchat/tool-cache";
import {
    ATXFINANCE_TOOL_DEFINITION,
    YAHOO_FINANCE_TOOL_DEFINITION
} from "@/modules/xchat/tool-definitions";
import {
    accountHealthFromWorkspacePreload,
    loadWorkspaceSnapshotPreload,
    portfolioSummaryFromWorkspacePreload,
    positionsSnapshotFromWorkspacePreload,
    type WorkspaceSnapshotContext,
    type WorkspaceSnapshotPreload
} from "@/modules/xchat/workspace-snapshot-for-prompt";

export type {
    WorkspaceSnapshotContext,
    WorkspaceSnapshotPreload
} from "@/modules/xchat/workspace-snapshot-for-prompt";

const MAX_OUTPUT_BYTES = 8 * 1024;
/** Cap rows returned by positions_snapshot before JSON serialization (freshness; not cached). */
const MAX_POSITIONS_RETURNED = 200;
const CACHEABLE_OPERATIONS = new Set(["watchlist_snapshot", "account_health"]);
/** Matches PATCH `/api/portfolios/:id/watchlist` batch size. */
const MAX_WATCHLIST_MUTATE_PER_CALL = 20;

const PRELOAD_SHORT_CIRCUIT_OPS = new Set([
  "portfolio_summary",
  "account_health",
  "positions_snapshot",
  "watchlist_snapshot"
]);

function watchlistSymbolToJson(s: WatchlistSymbol) {
  return {
    symbol: s.symbol,
    addedAt: s.addedAt instanceof Date ? s.addedAt.toISOString() : String(s.addedAt),
    ...(s.lineType !== undefined ? { lineType: s.lineType } : {}),
    ...(s.strategy !== undefined ? { strategy: s.strategy } : {}),
    ...(s.quantity !== undefined ? { quantity: s.quantity } : {}),
    ...(s.entryPrice !== undefined ? { entryPrice: s.entryPrice } : {})
  };
}

type WatchlistSummaryPayload =
  | { error: "no_watchlist" }
  | { name: string; symbolCount: number; symbols: ReturnType<typeof watchlistSymbolToJson>[] };

async function loadWatchlistSummary(ctx: ExecutorContext, portfolioId: string): Promise<WatchlistSummaryPayload> {
  const watchlist = await getPortfolioWatchlist({
    userId: ctx.userId,
    portfolioId,
    tenantId: ctx.tenantId
  });
  if (!watchlist) {
    return { error: "no_watchlist" };
  }
  const symbols = watchlist.symbols ?? [];
  return {
    name: watchlist.name,
    symbolCount: symbols.length,
    symbols: symbols.map(watchlistSymbolToJson)
  };
}

function watchlistSnapshotFromWorkspacePreload(p: WorkspaceSnapshotPreload): Record<string, unknown> {
  const wl = p.promptJson.watchlist;
  if ("error" in wl) {
    return { error: "no_watchlist" as const };
  }
  return {
    name: wl.name,
    symbolCount: wl.symbols.length,
    symbols: wl.symbols
  };
}

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

export type XfinanceToolExecutorContext = {
  userId: string;
  tenantId?: string;
  /**
   * Eager preload (tests, batch, or explicit opt-in). When this key is present (including `null`),
   * lazy load is disabled.
   */
  workspacePreload?: WorkspaceSnapshotPreload | null;
  /**
   * Ask route: load `WorkspaceSnapshotPreload` on first `PRELOAD_SHORT_CIRCUIT_OPS` tool call only
   * (same request), then short-circuit like eager preload.
   */
  workspaceLazyLoad?: WorkspaceSnapshotContext;
};

type ExecutorContext = XfinanceToolExecutorContext;

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

function buildOperations(invalidateWorkspacePreload: () => void): Record<string, OperationHandler> {
  return {
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
      const watchlist = await loadWatchlistSummary(ctx, portfolioId);

      return {
        name: portfolio.name,
        isDefault: portfolio.isDefault,
        accountCount: accounts.length,
        totalPositionCount: positions.length,
        accounts: accounts.map((a) => ({
          name: a.name,
          type: a.type,
          extAccountId: a.extAccountId,
          isDefault: a.isDefault,
          cashBalance: a.cashBalance ?? DEFAULT_ACCOUNT_CASH_BALANCE,
          positionCount: a._id ? (counts.get(a._id.toHexString()) ?? 0) : 0
        })),
        watchlist
      };
    },

    watchlist_snapshot: async (_args, ctx) => {
      const portfolio = await getDefaultPortfolioOrProvision(ctx);
      if (!portfolio?._id) {
        return { error: "no_default_portfolio" };
      }

      return loadWatchlistSummary(ctx, portfolio._id.toHexString());
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
      const portfolioId = portfolio._id.toHexString();
      const wl = await ensurePortfolioWatchlistForUser({
        userId: ctx.userId,
        portfolioId,
        tenantId: ctx.tenantId
      });
      if (!wl) {
        return { error: "no_watchlist" };
      }
      const existingSyms = new Set((wl.symbols ?? []).map((s) => s.symbol));
      const addEntries = toAdd.map((sym) =>
        existingSyms.has(sym)
          ? { symbol: sym }
          : {
              symbol: sym,
              lineType: WATCHLIST_ENTRY_DEFAULT_LINE_TYPE,
              strategy: WATCHLIST_ENTRY_DEFAULT_STRATEGY
            }
      );
      const mutateInput: {
        userId: string;
        portfolioId: string;
        tenantId?: string;
        addEntries: typeof addEntries;
        riskProfile?: "conservative" | "balanced" | "growth";
        outlook?: AccountOutlook;
      } = {
        userId: ctx.userId,
        portfolioId,
        tenantId: ctx.tenantId,
        addEntries
      };
      if (wl.riskProfile == null) {
        mutateInput.riskProfile = WATCHLIST_UPSERT_DEFAULT_RISK_PROFILE;
      }
      if (parseAccountOutlook(wl.outlook) == null) {
        mutateInput.outlook = WATCHLIST_UPSERT_DEFAULT_OUTLOOK;
      }
      const updated = await mutatePortfolioWatchlistSymbols(mutateInput);
      invalidateWorkspacePreload();
      deleteCachedToolResult(ctx.userId, "watchlist_snapshot");
      deleteCachedToolResult(ctx.userId, "account_health");
      if (!updated) {
        return { error: "no_watchlist" };
      }
      const symbols = updated.symbols ?? [];
      const addedNew = toAdd.filter((s) => !existingSyms.has(s));
      const alreadyHad = toAdd.filter((s) => existingSyms.has(s));
      return {
        ok: true,
        requested: toAdd,
        addedNew,
        alreadyPresent: alreadyHad,
        appliedDefaults: {
          newRowLineType: WATCHLIST_ENTRY_DEFAULT_LINE_TYPE,
          newRowStrategy: WATCHLIST_ENTRY_DEFAULT_STRATEGY,
          deskRiskIfWasUnset: WATCHLIST_UPSERT_DEFAULT_RISK_PROFILE,
          deskOutlookIfWasUnset: WATCHLIST_UPSERT_DEFAULT_OUTLOOK
        },
        watchlistName: updated.name,
        symbolCount: symbols.length,
        symbols: symbols.map(watchlistSymbolToJson)
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
      invalidateWorkspacePreload();
      deleteCachedToolResult(ctx.userId, "watchlist_snapshot");
      deleteCachedToolResult(ctx.userId, "account_health");
      if (!updated) {
        return { error: "no_watchlist" };
      }
      const symbols = updated.symbols ?? [];
      return {
        ok: true,
        removed: toRemove,
        watchlistName: updated.name,
        symbolCount: symbols.length,
        symbols: symbols.map(watchlistSymbolToJson)
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
}

function truncateOutput(output: string): string {
  const bytes = new TextEncoder().encode(output);
  if (bytes.length <= MAX_OUTPUT_BYTES) return output;
  const truncated = new TextDecoder().decode(bytes.slice(0, MAX_OUTPUT_BYTES));
  return truncated + "\n[truncated]";
}

function tryPreloadResult(
  operation: string,
  preload: WorkspaceSnapshotPreload,
  preloadValid: boolean
): string | null {
  if (!preloadValid || !PRELOAD_SHORT_CIRCUIT_OPS.has(operation)) {
    return null;
  }
  let data: Record<string, unknown>;
  switch (operation) {
    case "portfolio_summary":
      data = portfolioSummaryFromWorkspacePreload(preload);
      break;
    case "account_health":
      data = accountHealthFromWorkspacePreload(preload);
      break;
    case "positions_snapshot":
      data = positionsSnapshotFromWorkspacePreload(preload);
      break;
    case "watchlist_snapshot":
      data = watchlistSnapshotFromWorkspacePreload(preload);
      break;
    default:
      return null;
  }
  return truncateOutput(JSON.stringify(data));
}

export function createXfinanceToolExecutor(ctx: XfinanceToolExecutorContext): ToolExecutor {
  const lazyEnabled =
    ctx.workspaceLazyLoad != null && ctx.workspacePreload === undefined;

  let resolvedPreload: WorkspaceSnapshotPreload | null =
    ctx.workspacePreload !== undefined ? (ctx.workspacePreload ?? null) : null;
  let preloadValid = Boolean(resolvedPreload);
  let lazyFetchStarted = false;

  async function ensureLazyPreload(): Promise<void> {
    if (!lazyEnabled || lazyFetchStarted) {
      return;
    }
    lazyFetchStarted = true;
    try {
      const p = await loadWorkspaceSnapshotPreload(ctx.workspaceLazyLoad!);
      resolvedPreload = p;
      preloadValid = Boolean(p);
    } catch {
      resolvedPreload = null;
      preloadValid = false;
    }
  }

  const invalidateWorkspacePreload = (): void => {
    preloadValid = false;
  };

  const operations = buildOperations(invalidateWorkspacePreload);

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

    if (PRELOAD_SHORT_CIRCUIT_OPS.has(operation)) {
      await ensureLazyPreload();
    }

    if (resolvedPreload && preloadValid) {
      const fromPreload = tryPreloadResult(operation, resolvedPreload, preloadValid);
      if (fromPreload !== null) {
        return { result: fromPreload };
      }
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

export { ATXFINANCE_TOOL_DEFINITION, YAHOO_FINANCE_TOOL_DEFINITION };
