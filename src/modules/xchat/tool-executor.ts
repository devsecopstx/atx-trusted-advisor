import type { ToolExecutor } from "@/lib/xai";
import {
  getDefaultPortfolio,
  getPortfolioWatchlist,
  listPortfolioAccounts,
  listScheduledTasks,
  listTaskRuns
} from "@/modules/core-admin/repository";
import { getCachedToolResult, setCachedToolResult } from "@/modules/xchat/tool-cache";

const MAX_OUTPUT_BYTES = 8 * 1024;
const CACHEABLE_OPERATIONS = new Set(["portfolio_summary", "watchlist_snapshot", "account_health"]);

type ExecutorContext = {
  userId: string;
  tenantId?: string;
};

type OperationHandler = (
  args: Record<string, unknown>,
  ctx: ExecutorContext
) => Promise<unknown>;

const operations: Record<string, OperationHandler> = {
  portfolio_summary: async (_args, ctx) => {
    const portfolio = await getDefaultPortfolio(ctx.userId, {
      tenantId: ctx.tenantId
    });
    if (!portfolio?._id) {
      return { error: "no_default_portfolio" };
    }

    const accounts = await listPortfolioAccounts({
      userId: ctx.userId,
      portfolioId: portfolio._id.toHexString(),
      tenantId: ctx.tenantId
    });

    return {
      name: portfolio.name,
      isDefault: portfolio.isDefault,
      accountCount: accounts.length,
      accounts: accounts.map((a) => ({
        name: a.name,
        type: a.type,
        extAccountId: a.extAccountId,
        isDefault: a.isDefault
      }))
    };
  },

  watchlist_snapshot: async (_args, ctx) => {
    const portfolio = await getDefaultPortfolio(ctx.userId, {
      tenantId: ctx.tenantId
    });
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
      symbols: symbols.map((s) => s.symbol)
    };
  },

  account_health: async (_args, ctx) => {
    const portfolio = await getDefaultPortfolio(ctx.userId, {
      tenantId: ctx.tenantId
    });
    if (!portfolio?._id) {
      return { error: "no_default_portfolio" };
    }

    const accounts = await listPortfolioAccounts({
      userId: ctx.userId,
      portfolioId: portfolio._id.toHexString(),
      tenantId: ctx.tenantId
    });

    return {
      accountCount: accounts.length,
      accounts: accounts.map((a) => ({
        name: a.name,
        type: a.type,
        extAccountId: a.extAccountId,
        isDefault: a.isDefault
      }))
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
  return async (_name: string, args: Record<string, unknown>) => {
    const operation = typeof args.operation === "string" ? args.operation : "";
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

export const XFINANCE_TOOL_DEFINITION = {
  type: "function" as const,
  function: {
    name: "xfinance",
    description:
      "Query xFinance portfolio, watchlist, account, and task data for the authenticated user.",
    parameters: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: ["portfolio_summary", "watchlist_snapshot", "account_health", "task_status"],
          description: "The xFinance operation to execute."
        }
      },
      required: ["operation"]
    }
  }
};
