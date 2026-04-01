import { isXchatDebugEnvEnabled } from "@/lib/env";
import { getXchatTenantDebugFromContext } from "@/lib/xchat-debug-context";
import {
    DEFAULT_ACCOUNT_CASH_BALANCE,
    DEFAULT_EXT_BROKER_REF,
    getDefaultPortfolio,
    getPortfolioWatchlist,
    listPortfolioAccounts,
    listPortfolioPositionsByAccount,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import type { ObjectId } from "mongodb";

import type { Portfolio, WatchlistSymbol } from "@/modules/core-admin/types";
import {
    buildWorkspaceSnapshotCacheKey,
    getWorkspaceSnapshotCacheTtlSeconds,
    readWorkspaceSnapshotCache,
    writeWorkspaceSnapshotCache
} from "@/modules/xchat/workspace-snapshot-cache";

export type WorkspaceSnapshotContext = {
  userId: string;
  tenantId?: string;
};

/** Keep prompt size bounded; full book via atxfinance positions_snapshot. */
export const MAX_POSITION_ROWS_IN_SNAPSHOT = 120;

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

function watchlistSymbolToPromptJson(s: WatchlistSymbol) {
  return {
    symbol: s.symbol,
    addedAt: s.addedAt instanceof Date ? s.addedAt.toISOString() : String(s.addedAt),
    ...(s.lineType !== undefined ? { lineType: s.lineType } : {}),
    ...(s.strategy !== undefined ? { strategy: s.strategy } : {}),
    ...(s.quantity !== undefined ? { quantity: s.quantity } : {}),
    ...(s.entryPrice !== undefined ? { entryPrice: s.entryPrice } : {})
  };
}

/** JSON that appears in the system prompt (no full positions list). */
export type WorkspaceSnapshotPromptJson = {
  loadedAt: string;
  workspaceContentRev: number;
  portfolio: {
    id: string;
    name: string;
    isDefault: boolean;
    ext_broker_ref: string;
    totalPositionCount: number;
  };
  accounts: Array<{
    accountId: string;
    name: string;
    type: string;
    extAccountId: string;
    isDefault: boolean;
    cashBalance: number;
    positionCount: number;
  }>;
  positionsPreview: Array<{
    symbol: string;
    qty: number;
    avgCost: number;
    accountId: string;
  }>;
  positionsPreviewTruncated: boolean;
  positionsOmittedCount: number;
  watchlist:
    | {
        name: string;
        riskProfile: string | null;
        outlook: unknown;
        symbols: ReturnType<typeof watchlistSymbolToPromptJson>[];
      }
    | { error: "no_watchlist" };
};

/** Same-request preload for atx_function short-circuit (includes full positions; not in prompt JSON). */
export type WorkspaceSnapshotPreload = {
  promptJson: WorkspaceSnapshotPromptJson;
  positionsFull: Array<{
    symbol: string;
    qty: number;
    avgCost: number;
    accountId: string;
  }>;
};

function normalizeWorkspaceContentRev(portfolio: { workspaceContentRev?: number }): number {
  const r = portfolio.workspaceContentRev;
  return typeof r === "number" && Number.isFinite(r) && r >= 0 ? Math.floor(r) : 0;
}

async function resolveDefaultPortfolio(ctx: WorkspaceSnapshotContext) {
  const existing = await getDefaultPortfolio(ctx.userId, { tenantId: ctx.tenantId });
  if (existing?._id) {
    return existing;
  }
  try {
    const { portfolio: provisioned } = await provisionDefaultPortfolioForUser({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      watchlistSymbols: ["TSLA"]
    });
    return provisioned;
  } catch {
    return null;
  }
}

async function buildPreloadFromPortfolio(
  ctx: WorkspaceSnapshotContext,
  portfolio: Portfolio & { _id: NonNullable<Portfolio["_id"]> }
): Promise<WorkspaceSnapshotPreload | null> {
  const t0 = performance.now();
  if (!portfolio._id) {
    return null;
  }

  const portfolioId = portfolio._id.toHexString();
  const rev = normalizeWorkspaceContentRev(portfolio);
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

  const watchlist = await getPortfolioWatchlist({
    userId: ctx.userId,
    portfolioId,
    tenantId: ctx.tenantId
  });

  const loadedAt = new Date().toISOString();
  const promptJson: WorkspaceSnapshotPromptJson = {
    loadedAt,
    workspaceContentRev: rev,
    portfolio: {
      id: portfolioId,
      name: portfolio.name,
      isDefault: portfolio.isDefault,
      ext_broker_ref: portfolio.ext_broker_ref ?? DEFAULT_EXT_BROKER_REF,
      totalPositionCount: positions.length
    },
    accounts: accounts.map((a) => ({
      accountId: a._id ? a._id.toHexString() : "",
      name: a.name,
      type: a.type,
      extAccountId: a.extAccountId,
      isDefault: a.isDefault,
      cashBalance: a.cashBalance ?? DEFAULT_ACCOUNT_CASH_BALANCE,
      positionCount: a._id ? (counts.get(a._id.toHexString()) ?? 0) : 0
    })),
    positionsPreview: positions.slice(0, MAX_POSITION_ROWS_IN_SNAPSHOT).map((p) => ({
      symbol: p.symbol,
      qty: p.qty,
      avgCost: p.avgCost,
      accountId: p.accountId.toHexString()
    })),
    positionsPreviewTruncated: positions.length > MAX_POSITION_ROWS_IN_SNAPSHOT,
    positionsOmittedCount:
      positions.length > MAX_POSITION_ROWS_IN_SNAPSHOT
        ? positions.length - MAX_POSITION_ROWS_IN_SNAPSHOT
        : 0,
    watchlist: watchlist
      ? {
          name: watchlist.name,
          riskProfile: watchlist.riskProfile ?? null,
          outlook: watchlist.outlook ?? null,
          symbols: (watchlist.symbols ?? []).map(watchlistSymbolToPromptJson)
        }
      : { error: "no_watchlist" as const }
  };

  const positionsFull = positions.map((p) => ({
    symbol: p.symbol,
    qty: p.qty,
    avgCost: p.avgCost,
    accountId: p.accountId.toHexString()
  }));

  const elapsedMs = Math.round(performance.now() - t0);
  if (isXchatDebugEnvEnabled() || getXchatTenantDebugFromContext()) {
    console.info("[xchat/debug]", {
      type: "workspace_snapshot_build",
      source: "mongo",
      elapsedMs,
      portfolioId,
      workspaceContentRev: rev,
      positionCount: positions.length
    });
  }

  return { promptJson, positionsFull };
}

/**
 * Loads workspace snapshot (Mongo + optional Redis/in-memory cache). Used by ask, batch, orchestrator.
 */
export async function loadWorkspaceSnapshotPreload(
  ctx: WorkspaceSnapshotContext
): Promise<WorkspaceSnapshotPreload | null> {
  const tStart = performance.now();
  const portfolio = await resolveDefaultPortfolio(ctx);
  if (!portfolio?._id) {
    const elapsedMs = Math.round(performance.now() - tStart);
    if (isXchatDebugEnvEnabled() || getXchatTenantDebugFromContext()) {
      console.info("[xchat/debug]", {
        type: "workspace_snapshot_load",
        source: "null",
        elapsedMs
      });
    }
    return null;
  }

  const portfolioId = portfolio._id.toHexString();
  const rev = normalizeWorkspaceContentRev(portfolio);
  const cacheKey = buildWorkspaceSnapshotCacheKey({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    portfolioIdHex: portfolioId,
    workspaceContentRev: rev
  });

  const cached = await readWorkspaceSnapshotCache(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as WorkspaceSnapshotPreload;
      if (
        parsed?.promptJson &&
        typeof parsed.promptJson.loadedAt === "string" &&
        parsed.promptJson.workspaceContentRev === rev &&
        parsed.promptJson.portfolio?.id === portfolioId &&
        Array.isArray(parsed.positionsFull)
      ) {
        const elapsedMs = Math.round(performance.now() - tStart);
        if (isXchatDebugEnvEnabled() || getXchatTenantDebugFromContext()) {
          console.info("[xchat/debug]", {
            type: "workspace_snapshot_load",
            source: "cache",
            elapsedMs,
            portfolioId,
            workspaceContentRev: rev
          });
        }
        return parsed;
      }
    } catch {
      /* fall through */
    }
  }

  const built = await buildPreloadFromPortfolio(
    ctx,
    portfolio as Portfolio & { _id: ObjectId }
  );
  if (built) {
    const ttl = getWorkspaceSnapshotCacheTtlSeconds();
    try {
      await writeWorkspaceSnapshotCache(cacheKey, JSON.stringify(built), ttl);
    } catch {
      /* ignore */
    }
  }
  const elapsedMs = Math.round(performance.now() - tStart);
  if (isXchatDebugEnvEnabled() || getXchatTenantDebugFromContext()) {
    console.info("[xchat/debug]", {
      type: "workspace_snapshot_load",
      source: built ? "mongo" : "null",
      elapsedMs,
      portfolioId,
      workspaceContentRev: rev
    });
  }
  return built;
}

export function formatWorkspaceServerSnapshotBlock(preload: WorkspaceSnapshotPreload): string {
  const json = JSON.stringify(preload.promptJson);
  return [
    "Workspace snapshot (loaded server-side for this request; data is current as of loadedAt — use the atxfinance tool for a full positions book refresh, market_quote, or task_status if needed):",
    "```json",
    json,
    "```"
  ].join("\n");
}

/**
 * Loads portfolio, accounts, watchlist, and a capped positions preview server-side
 * before xChat ask / batch model calls. Injected into the system prompt so the model
 * can answer from fresh workspace data without a tool round-trip; atxfinance remains
 * for refresh, full positions, quotes, and tasks.
 */
export async function buildWorkspaceServerSnapshotBlock(
  ctx: WorkspaceSnapshotContext
): Promise<string | null> {
  const preload = await loadWorkspaceSnapshotPreload(ctx);
  return preload ? formatWorkspaceServerSnapshotBlock(preload) : null;
}

/** atx_function portfolio_summary from same-request preload (watchlist summary shape). */
export function portfolioSummaryFromWorkspacePreload(p: WorkspaceSnapshotPreload): Record<string, unknown> {
  const j = p.promptJson;
  const wl = j.watchlist;
  const watchlist =
    "error" in wl
      ? { error: "no_watchlist" as const }
      : {
          name: wl.name,
          symbolCount: wl.symbols.length,
          symbols: wl.symbols
        };

  return {
    name: j.portfolio.name,
    isDefault: j.portfolio.isDefault,
    ext_broker_ref: j.portfolio.ext_broker_ref,
    accountCount: j.accounts.length,
    totalPositionCount: j.portfolio.totalPositionCount,
    accounts: j.accounts.map((a) => ({
      name: a.name,
      type: a.type,
      extAccountId: a.extAccountId,
      isDefault: a.isDefault,
      cashBalance: a.cashBalance,
      positionCount: a.positionCount
    })),
    watchlist
  };
}

/** atx_function account_health from same-request preload. */
export function accountHealthFromWorkspacePreload(p: WorkspaceSnapshotPreload): Record<string, unknown> {
  const defaultAccount = p.promptJson.accounts.find((a) => a.isDefault);
  return {
    accountCount: p.promptJson.accounts.length,
    accounts: p.promptJson.accounts.map((a) => ({
      name: a.name,
      type: a.type,
      extAccountId: a.extAccountId,
      isDefault: a.isDefault,
      cashBalance: a.cashBalance
    })),
    defaultAccountName: defaultAccount?.name
  };
}

const MAX_POSITIONS_TOOL_RETURN = 200;

/** atx_function positions_snapshot from same-request preload (full book already in memory). */
export function positionsSnapshotFromWorkspacePreload(p: WorkspaceSnapshotPreload): Record<string, unknown> {
  const portfolioName = p.promptJson.portfolio.name;
  const accounts = p.promptJson.accounts.filter((a) => a.accountId);
  const all = p.positionsFull;
  const totalAvailable = all.length;
  const truncated = totalAvailable > MAX_POSITIONS_TOOL_RETURN;
  const sliced = all.slice(0, MAX_POSITIONS_TOOL_RETURN);

  const byAccountHex = new Map<string, typeof sliced>();
  for (const row of sliced) {
    const list = byAccountHex.get(row.accountId) ?? [];
    list.push(row);
    byAccountHex.set(row.accountId, list);
  }

  const accountsWithPositions = accounts.map((a) => {
    const rows = byAccountHex.get(a.accountId) ?? [];
    return {
      name: a.name,
      isDefault: a.isDefault,
      positions: rows.map((r) => ({
        symbol: r.symbol,
        qty: r.qty,
        avgCost: r.avgCost
      }))
    };
  });

  return {
    portfolioName,
    accounts: accountsWithPositions,
    totalPositionsReturned: sliced.length,
    totalPositionsAvailable: totalAvailable,
    truncated,
    ...(truncated ? { omittedCount: totalAvailable - sliced.length } : {})
  };
}
