import { maskAccountXrefForDisplay } from "@/lib/account-xref-display";
import { tryFetchBackendPortfolioWorkspaceSnapshot } from "@/lib/backend-portfolio-snapshot";
import { isXchatStructuredDebugEnabled } from "@/lib/xchat-debug";
import {
    DEFAULT_ACCOUNT_CASH_BALANCE,
    getDefaultPortfolio,
    getPortfolioByIdForSessionUser,
    getUserWatchlist,
    listPortfolioAccounts,
    listPortfolioPositionsByAccount,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import type { ObjectId } from "mongodb";

/**
 * Creates a horizontal bar chart showing percentage allocation per position
 * Uses Unicode blocks (█) for bars, professional and rounded
 */
function createPortfolioAllocationChart(positions: Array<{ symbol: string; qty: number; avgCost: number }>, cashBalance: number): string {
  if (positions.length === 0 && cashBalance === 0) {
    return "No positions or cash to display";
  }

  // Calculate position values
  const positionValues = positions.map(pos => ({
    symbol: pos.symbol,
    value: Math.abs(pos.qty * pos.avgCost),
    qty: pos.qty,
    avgCost: pos.avgCost
  }));

  // Add cash as a "position"
  if (cashBalance > 0) {
    positionValues.push({
      symbol: "CASH",
      value: cashBalance,
      qty: 1,
      avgCost: cashBalance
    });
  }

  // Calculate total portfolio value
  const totalValue = positionValues.reduce((sum, pos) => sum + pos.value, 0);

  if (totalValue === 0) {
    return "Portfolio has no value to display";
  }

  // Sort by value descending and calculate percentages
  const sortedPositions = positionValues
    .map(pos => ({
      ...pos,
      percentage: (pos.value / totalValue) * 100
    }))
    .sort((a, b) => b.value - a.value);

  // Create bar chart
  const maxBarWidth = 20; // Maximum bar length
  let chart = "```\nPortfolio Allocation:\n\n";

  for (const pos of sortedPositions) {
    const barLength = Math.max(1, Math.round((pos.percentage / 100) * maxBarWidth));
    const bar = "█".repeat(barLength);
    const percentage = pos.percentage.toFixed(1);
    const symbol = pos.symbol.padEnd(8);
    const value = pos.value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

    chart += `${symbol} ${percentage}% ${bar} ${value}\n`;
  }

  chart += `\nTotal Value: ${totalValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}\n\`\`\``;

  return chart;
}

import type { Portfolio, PositionType, WatchlistSymbol } from "@/modules/core-admin/types";
import { normalizePositionType } from "@/modules/core-admin/types";
import {
    loadInvestmentOutlookPromptJson,
    type InvestmentOutlookPromptJson
} from "@/modules/portfolio/investment-outlooks";
import {
    computeBookTailRiskMonteCarlo,
    isEquitySymbolForTailRisk,
    mapWatchlistRiskProfileToMcTier,
    type BookTailRiskSummaryJson
} from "@/modules/strategy-options/monte-carlo-tail-risk";
import { lookupSymbols } from "@/modules/watchlist/yahoo-symbol-lookup";
import {
    findPortfolioWorkspaceSnapshot,
    upsertPortfolioWorkspaceSnapshot
} from "@/modules/xchat/portfolio-workspace-snapshot-repository";
import {
    formatWatchlistAddedAtUtc,
    formatWatchlistSpotPriceUsd,
    formatWatchlistTargetEntryNotional100xFromQuotePrice,
    formatWatchlistTargetEntryNotional100xUsd,
    formatWatchlistTargetEntryStored
} from "@/modules/xchat/watchlist-prompt-format";
import {
    buildWorkspaceSnapshotCacheKey,
    getWorkspaceSnapshotCacheTtlSeconds,
    readWorkspaceSnapshotCache,
    writeWorkspaceSnapshotCache
} from "@/modules/xchat/workspace-snapshot-cache";

/** `[xchat/debug]` + JSON.stringify so dev logs (`tee .next/dev.log`) parse with `jq` (see xchat-debug-logging.md). */
function logWorkspaceSnapshotDebug(payload: Record<string, unknown>): void {
  console.info(
    "[xchat/debug]",
    JSON.stringify({
      ts: new Date().toISOString(),
      ...payload
    })
  );
}

/**
 * Safe UTF-8 byte length of JSON.stringify for observability (payload sizes, prompt block bloat).
 * Never throws; returns 0 on failure. Used for xchat perf/debug metrics before/after slimming.
 */
export function measureJsonBytes(obj: unknown): number {
  try {
    const s = JSON.stringify(obj ?? null);
    return Buffer.byteLength(s, "utf8");
  } catch {
    return 0;
  }
}

export type WorkspaceSnapshotContext = {
  userId: string;
  tenantId?: string;
  workspacePortfolioId?: string | null;
};

export type LoadWorkspaceSnapshotPreloadOptions = {
  /**
   * **cached_first** — watchlist spot/target columns use Redis batch quotes + in-memory lookup cache only (no Yahoo HTTP on miss).
   * **live** — allow Yahoo batch fetch on cache miss (default).
   */
  snapshotQuoteNetwork?: "cached_first" | "live";
  /**
   * When set and BFF can reach Spring, try **`GET /api/portfolios/{id}/snapshot`** (JVM Redis read-through)
   * after the local snapshot cache miss and before Mongo materialized read.
   */
  coordinatingRequest?: Request;
};

/** Keep prompt size bounded; full book via atxfinance positions_snapshot.
 * Reduced from 120 → 40 as high-impact slim for model context tokens + cache payloads.
 * Previews are hints only; model should call positions_snapshot for depth.
 */
export const MAX_POSITION_ROWS_IN_SNAPSHOT = 40;

/** Unique symbols in first-seen order (for preload hints / options-desk universe). */
export function dedupeSymbolsPreservingOrder(symbols: readonly string[], max?: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of symbols) {
    const sym = raw.trim().toUpperCase();
    if (!sym || seen.has(sym)) {
      continue;
    }
    seen.add(sym);
    out.push(sym);
    if (max != null && out.length >= max) {
      break;
    }
  }
  return out;
}

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

function watchlistSymbolToPromptJson(s: WatchlistSymbol, quotePrice?: number) {
  const addedAtIso = s.addedAt instanceof Date ? s.addedAt.toISOString() : String(s.addedAt);
  const hasEntry = s.entryPrice !== undefined;
  return {
    symbol: s.symbol,
    addedAt: addedAtIso,
    /** Prefer this (and targetEntryDisplay) when listing watchlist for users — matches direct watchlist replies. */
    addedAtDisplay: formatWatchlistAddedAtUtc(addedAtIso),
    spotPriceDisplay: formatWatchlistSpotPriceUsd(quotePrice),
    targetEntryNotional100xUsdDisplay: formatWatchlistTargetEntryNotional100xUsd(quotePrice),
    ...(s.lineType !== undefined ? { lineType: s.lineType } : {}),
    ...(s.strategy !== undefined ? { strategy: s.strategy } : {}),
    ...(s.quantity !== undefined ? { quantity: s.quantity } : {}),
    ...(hasEntry ? { entryPrice: s.entryPrice, targetEntryPrice: s.entryPrice } : {}),
    /** Desk / CSV "entry price" (USD). */
    targetEntryDisplay: formatWatchlistTargetEntryStored(s.entryPrice),
    /** Same as Watchlist UI "Target entry" column: 100× live quote (Yahoo), whole dollars. */
    targetEntryNotional100xDisplay: formatWatchlistTargetEntryNotional100xFromQuotePrice(quotePrice)
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
  /** Monte Carlo book-level tail metrics (fat-tail + jumps); optional when equity book empty or compute skipped. */
  bookTailRisk?: BookTailRiskSummaryJson | null;
  /** Pre-computed wheel/CSP strikes from `investment_outlooks` (options scanner); omitted when unset/expired. */
  investmentOutlook?: InvestmentOutlookPromptJson;
};

/** Same-request preload for atx_function short-circuit (includes full positions; not in prompt JSON). */
export type WorkspaceSnapshotPreload = {
  promptJson: WorkspaceSnapshotPromptJson;
  positionsFull: Array<{
    symbol: string;
    qty: number;
    avgCost: number;
    accountId: string;
    /** stock | option | cash — omitted on legacy cached rows → treat as stock. */
    positionType?: PositionType;
  }>;
};

/** Exported for find-options / other readers that must match snapshot cache rev checks. */
export function normalizeWorkspaceContentRev(portfolio: { workspaceContentRev?: number }): number {
  const r = portfolio.workspaceContentRev;
  return typeof r === "number" && Number.isFinite(r) && r >= 0 ? Math.floor(r) : 0;
}

export function isValidWorkspacePreloadPayload(
  parsed: unknown,
  portfolioId: string,
  rev: number
): parsed is WorkspaceSnapshotPreload {
  if (!parsed || typeof parsed !== "object") {
    return false;
  }
  const p = parsed as WorkspaceSnapshotPreload;
  return Boolean(
    p.promptJson &&
      typeof p.promptJson.loadedAt === "string" &&
      p.promptJson.workspaceContentRev === rev &&
      p.promptJson.portfolio?.id === portfolioId &&
      Array.isArray(p.positionsFull)
  );
}

async function resolveDefaultPortfolio(ctx: WorkspaceSnapshotContext) {
  const requestedPortfolioId = ctx.workspacePortfolioId?.trim();
  if (requestedPortfolioId) {
    const selected = await getPortfolioByIdForSessionUser({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      portfolioId: requestedPortfolioId
    });
    if (selected?._id) {
      return selected;
    }
  }
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

export async function buildWorkspaceSnapshotPreloadFromPortfolio(
  ctx: WorkspaceSnapshotContext,
  portfolio: Portfolio & { _id: NonNullable<Portfolio["_id"]> },
  quoteAllowNetwork: boolean
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

  const watchlist = await getUserWatchlist({
    userId: ctx.userId,
    tenantId: ctx.tenantId
  });

  const wlSymbols = watchlist?.symbols ?? [];
  const fetchedQuotes =
    wlSymbols.length > 0
      ? await lookupSymbols(
          wlSymbols.map((x) => x.symbol),
          { allowNetwork: quoteAllowNetwork }
        )
      : null;
  const quoteMap = fetchedQuotes instanceof Map ? fetchedQuotes : new Map();

  const loadedAt = new Date().toISOString();
  let bookTailRisk: BookTailRiskSummaryJson | null = null;
  const equityRows = positions.filter((p) => isEquitySymbolForTailRisk(p.symbol));
  const equityNotional = equityRows.reduce((sum, p) => sum + Math.abs(p.qty * p.avgCost), 0);
  if (equityNotional > 1e-6 && equityRows.length > 0) {
    const wlRisk =
      watchlist && !("error" in watchlist) ? (watchlist.riskProfile ?? null) : null;
    const tier = mapWatchlistRiskProfileToMcTier(wlRisk);
    const holdings = equityRows.map((p) => ({
      symbol: p.symbol.trim().toUpperCase(),
      weight: Math.abs(p.qty * p.avgCost) / equityNotional
    }));
    try {
      const rawPaths = Number.parseInt(process.env.WORKSPACE_TAIL_RISK_PATHS ?? "12000", 10);
      const pathCount = Number.isFinite(rawPaths)
        ? Math.min(50_000, Math.max(5000, rawPaths))
        : 12_000;
      bookTailRisk = await computeBookTailRiskMonteCarlo({
        tier,
        holdings,
        chainsByTicker: {},
        pathCount
      });
    } catch {
      bookTailRisk = null;
    }
  }

  const investmentOutlook = await loadInvestmentOutlookPromptJson(portfolio._id);

  const promptJson: WorkspaceSnapshotPromptJson = {
    loadedAt,
    workspaceContentRev: rev,
    portfolio: {
      id: portfolioId,
      name: portfolio.name,
      isDefault: portfolio.isDefault,
      totalPositionCount: positions.length
    },
    accounts: accounts.map((a) => ({
      accountId: a._id ? a._id.toHexString() : "",
      name: a.name,
      type: a.type,
      extAccountId: maskAccountXrefForDisplay(a.extAccountId),
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
        symbols: wlSymbols.map((s) =>
          watchlistSymbolToPromptJson(s, quoteMap.get(s.symbol.trim().toUpperCase())?.price)
        )
      }
      : { error: "no_watchlist" as const },
    ...(bookTailRisk ? { bookTailRisk } : {}),
    ...(investmentOutlook ? { investmentOutlook } : {})
  };

  const positionsFull = positions.map((p) => ({
    symbol: p.symbol,
    qty: p.qty,
    avgCost: p.avgCost,
    accountId: p.accountId.toHexString(),
    positionType: normalizePositionType(p.type)
  }));

  const elapsedMs = Math.round(performance.now() - t0);

  // Observability: payload sizes (prompt bloat, cache/Mongo materialization cost, tool context).
  // These will be used to measure impact of prompt-only slim view + conditional analytics.
  const promptJsonBytes = measureJsonBytes(promptJson);
  const positionsFullCount = positionsFull.length;
  const preloadBytes = measureJsonBytes({ promptJson, positionsFull });
  const watchlistSymbolCount =
    "error" in promptJson.watchlist ? 0 : promptJson.watchlist.symbols.length;
  const positionsPreviewCount = promptJson.positionsPreview.length;

  if (isXchatStructuredDebugEnabled()) {
    logWorkspaceSnapshotDebug({
      type: "workspace_snapshot_build",
      source: "mongo",
      elapsedMs,
      portfolioId,
      workspaceContentRev: rev,
      positionCount: positions.length,
      promptJsonBytes,
      positionsPreviewCount,
      positionsFullCount,
      preloadBytes,
      watchlistSymbolCount,
      hasBookTailRisk: !!promptJson.bookTailRisk,
      hasInvestmentOutlook: !!promptJson.investmentOutlook
    });
  }

  return { promptJson, positionsFull };
}

/**
 * Loads workspace snapshot (Mongo + optional Redis/in-memory cache). Used by ask, batch, orchestrator.
 */
export async function loadWorkspaceSnapshotPreload(
  ctx: WorkspaceSnapshotContext,
  options?: LoadWorkspaceSnapshotPreloadOptions
): Promise<WorkspaceSnapshotPreload | null> {
  const quoteAllowNetwork = options?.snapshotQuoteNetwork !== "cached_first";
  const tStart = performance.now();
  const portfolio = await resolveDefaultPortfolio(ctx);
  if (!portfolio?._id) {
    const elapsedMs = Math.round(performance.now() - tStart);
    if (isXchatStructuredDebugEnabled()) {
      logWorkspaceSnapshotDebug({
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
      const parsed = JSON.parse(cached) as unknown;
      if (isValidWorkspacePreloadPayload(parsed, portfolioId, rev)) {
        const elapsedMs = Math.round(performance.now() - tStart);
        if (isXchatStructuredDebugEnabled()) {
          const p = parsed as WorkspaceSnapshotPreload;
          const promptJsonBytes = measureJsonBytes(p.promptJson);
          const positionsFullCount = p.positionsFull?.length ?? 0;
          const preloadBytes = measureJsonBytes(p);
          const watchlistSymbolCount =
            "error" in p.promptJson.watchlist ? 0 : p.promptJson.watchlist.symbols.length;
          const positionsPreviewCount = p.promptJson.positionsPreview?.length ?? 0;
          logWorkspaceSnapshotDebug({
            type: "workspace_snapshot_load",
            source: "cache",
            elapsedMs,
            portfolioId,
            workspaceContentRev: rev,
            promptJsonBytes,
            positionsPreviewCount,
            positionsFullCount,
            preloadBytes,
            watchlistSymbolCount,
            hasBookTailRisk: !!p.promptJson.bookTailRisk,
            hasInvestmentOutlook: !!p.promptJson.investmentOutlook
          });
        }
        return parsed;
      }
    } catch {
      /* fall through */
    }
  }

  if (options?.coordinatingRequest) {
    const tJvm = performance.now();
    const fromJvm = await tryFetchBackendPortfolioWorkspaceSnapshot({
      coordinatingRequest: options.coordinatingRequest,
      portfolioIdHex: portfolioId,
      workspaceContentRev: rev
    });
    if (fromJvm && isValidWorkspacePreloadPayload(fromJvm, portfolioId, rev)) {
      const ttl = getWorkspaceSnapshotCacheTtlSeconds();
      try {
        await writeWorkspaceSnapshotCache(cacheKey, JSON.stringify(fromJvm), ttl);
      } catch {
        /* ignore */
      }
      const elapsedMs = Math.round(performance.now() - tStart);
      const backendFetchMs = Math.round(performance.now() - tJvm);
      if (isXchatStructuredDebugEnabled()) {
        const p = fromJvm as WorkspaceSnapshotPreload;
        const promptJsonBytes = measureJsonBytes(p.promptJson);
        const positionsFullCount = p.positionsFull?.length ?? 0;
        const preloadBytes = measureJsonBytes(p);
        const watchlistSymbolCount =
          "error" in p.promptJson.watchlist ? 0 : p.promptJson.watchlist.symbols.length;
        const positionsPreviewCount = p.promptJson.positionsPreview?.length ?? 0;
        logWorkspaceSnapshotDebug({
          type: "workspace_snapshot_backend",
          source: "jvm_snapshot",
          elapsedMs,
          backendFetchMs,
          portfolioId,
          workspaceContentRev: rev,
          promptJsonBytes,
          positionsPreviewCount,
          positionsFullCount,
          preloadBytes,
          watchlistSymbolCount,
          hasBookTailRisk: !!p.promptJson.bookTailRisk,
          hasInvestmentOutlook: !!p.promptJson.investmentOutlook
        });
      }
      return fromJvm;
    }
  }

  const materialized = await findPortfolioWorkspaceSnapshot({
    portfolioIdHex: portfolioId,
    workspaceContentRev: rev
  });
  if (materialized != null && isValidWorkspacePreloadPayload(materialized, portfolioId, rev)) {
    const ttl = getWorkspaceSnapshotCacheTtlSeconds();
    try {
      await writeWorkspaceSnapshotCache(cacheKey, JSON.stringify(materialized), ttl);
    } catch {
      /* ignore */
    }
    const elapsedMs = Math.round(performance.now() - tStart);
    if (isXchatStructuredDebugEnabled()) {
      const p = materialized as WorkspaceSnapshotPreload;
      const promptJsonBytes = measureJsonBytes(p.promptJson);
      const positionsFullCount = p.positionsFull?.length ?? 0;
      const preloadBytes = measureJsonBytes(p);
      const watchlistSymbolCount =
        "error" in p.promptJson.watchlist ? 0 : p.promptJson.watchlist.symbols.length;
      const positionsPreviewCount = p.promptJson.positionsPreview?.length ?? 0;
      logWorkspaceSnapshotDebug({
        type: "workspace_snapshot_load",
        source: "materialized",
        elapsedMs,
        portfolioId,
        workspaceContentRev: rev,
        promptJsonBytes,
        positionsPreviewCount,
        positionsFullCount,
        preloadBytes,
        watchlistSymbolCount,
        hasBookTailRisk: !!p.promptJson.bookTailRisk,
        hasInvestmentOutlook: !!p.promptJson.investmentOutlook
      });
    }
    return materialized;
  }

  const built = await buildWorkspaceSnapshotPreloadFromPortfolio(
    ctx,
    portfolio as Portfolio & { _id: ObjectId },
    quoteAllowNetwork
  );
  if (built) {
    const ttl = getWorkspaceSnapshotCacheTtlSeconds();
    try {
      await writeWorkspaceSnapshotCache(cacheKey, JSON.stringify(built), ttl);
    } catch {
      /* ignore */
    }
    void upsertPortfolioWorkspaceSnapshot({
      portfolioIdHex: portfolioId,
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      workspaceContentRev: rev,
      preload: built,
      source: "xchat_ask"
    }).catch(() => {
      /* ignore */
    });
  }
  const elapsedMs = Math.round(performance.now() - tStart);
  if (isXchatStructuredDebugEnabled()) {
    if (built) {
      const p = built;
      const promptJsonBytes = measureJsonBytes(p.promptJson);
      const positionsFullCount = p.positionsFull?.length ?? 0;
      const preloadBytes = measureJsonBytes(p);
      const watchlistSymbolCount =
        "error" in p.promptJson.watchlist ? 0 : p.promptJson.watchlist.symbols.length;
      const positionsPreviewCount = p.promptJson.positionsPreview?.length ?? 0;
      logWorkspaceSnapshotDebug({
        type: "workspace_snapshot_load",
        source: "mongo",
        elapsedMs,
        portfolioId,
        workspaceContentRev: rev,
        promptJsonBytes,
        positionsPreviewCount,
        positionsFullCount,
        preloadBytes,
        watchlistSymbolCount,
        hasBookTailRisk: !!p.promptJson.bookTailRisk,
        hasInvestmentOutlook: !!p.promptJson.investmentOutlook
      });
    } else {
      logWorkspaceSnapshotDebug({
        type: "workspace_snapshot_load",
        source: "null",
        elapsedMs,
        portfolioId,
        workspaceContentRev: rev
      });
    }
  }
  return built;
}

/** Slim projection for the model system prompt block only (prompt-only view).
 * Strips heavy analytics (bookTailRisk, investmentOutlook) unless explicitly for quant/desk.
 * This is the main token win (MC objects and outlook data can be large).
 * Watchlist symbols and other preview fields are kept as built (rich but bounded by MAX).
 * Keeps full rich shape in the preload object for tool short-circuits etc.
 */
function getPromptSlimSnapshotJson(
  preload: WorkspaceSnapshotPreload,
  includeHeavyAnalytics = false
): WorkspaceSnapshotPromptJson {
  const j = preload.promptJson;
  const base: WorkspaceSnapshotPromptJson = {
    ...j,
    positionsPreview: j.positionsPreview.slice(0, MAX_POSITION_ROWS_IN_SNAPSHOT)
  };

  if (!includeHeavyAnalytics) {
    // Conditional tail/outlook: omit from prompt block (model gets via tools or quant-specific full block)
    (base as any).bookTailRisk = undefined;
    (base as any).investmentOutlook = undefined;
  }

  return base;
}

export function formatWorkspaceServerSnapshotBlock(
  preload: WorkspaceSnapshotPreload,
  options?: { includeHeavyAnalytics?: boolean }
): string {
  const slim = getPromptSlimSnapshotJson(preload, options?.includeHeavyAnalytics ?? false);
  const json = JSON.stringify(slim);
  return [
    "Workspace snapshot (loaded server-side for this request; data is current as of loadedAt — use the atxfinance tool for a full positions book refresh, market_quote, or task_status if needed):",
    "```json",
    json,
    "```"
  ].join("\n");
}

/** Compact text for system prompt when eager preload ran — avoids duplicating full JSON + cuts redundant tool rounds. */
export function buildWorkspacePreloadHintForSystemPrompt(preload: WorkspaceSnapshotPreload): string {
  const j = preload.promptJson;
  const wl = j.watchlist;
  const wlSummary =
    "error" in wl
      ? "watchlist: none"
      : `watchlist "${wl.name}" (${wl.symbols.length} symbols)`;
  const prevSyms = dedupeSymbolsPreservingOrder(
    j.positionsPreview.map((p) => p.symbol),
    12
  );
  const wlSyms =
    "error" in wl
      ? []
      : dedupeSymbolsPreservingOrder(
          wl.symbols.map((s) => String(s.symbol)),
          16
        );
  const holdingsWatchlistUniverse = dedupeSymbolsPreservingOrder([
    ...j.positionsPreview.map((p) => p.symbol),
    ...("error" in wl ? [] : wl.symbols.map((s) => String(s.symbol)))
  ]);

  const posHint =
    j.portfolio.totalPositionCount === 0
      ? "No equity positions recorded for this portfolio."
      : j.positionsPreview.length === 0
        ? `Positions preview empty (${j.portfolio.totalPositionCount} total); call positions_snapshot for the full book if needed.`
        : `Positions preview: ${j.positionsPreview.length} row(s); total position count ${j.portfolio.totalPositionCount}. Preview symbols: ${prevSyms.join(", ")}.`;

  const emptyBookGuard =
    j.portfolio.totalPositionCount === 0
      ? "If the user asks for covered-call or wheel ideas tied to their holdings, do not run options_scan for book-specific income plays until positions exist—tell them to add or import holdings."
      : "";

  const io = j.investmentOutlook;
  const ioHint =
    io && io.symbols.length > 0
      ? `Pre-computed wheel/outlook (scanner): ${io.symbols.length} symbol(s), as-of ${io.updatedAt.slice(0, 10)} UTC, valid until ${io.expiresAt.slice(0, 10)} — use workspace JSON investmentOutlook for strikes/expiry (no extra chain fetch needed for these candidates).`
      : "";

  return [
    `Workspace preload hint (this request; refresh via atx_function if stale): portfolio "${j.portfolio.name}" (${j.portfolio.id}), rev ${j.workspaceContentRev}.`,
    `Accounts: ${j.accounts.length}. ${wlSummary}.`,
    posHint,
    wlSyms.length > 0 ? `Watchlist symbols (sample): ${wlSyms.join(", ")}.` : "",
    holdingsWatchlistUniverse.length > 0
      ? `Symbol universe (holdings ∪ watchlist, deduped): ${holdingsWatchlistUniverse.join(", ")}.`
      : "",
    ioHint,
    emptyBookGuard
  ]
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

/**
 * Loads portfolio, accounts, watchlist, and a capped positions preview server-side
 * before xChat ask / batch model calls. Injected into the system prompt so the model
 * can answer from fresh workspace data without a tool round-trip; atxfinance remains
 * for refresh, full positions, quotes, and tasks.
 */
export async function buildWorkspaceServerSnapshotBlock(
  ctx: WorkspaceSnapshotContext,
  options?: { includeHeavyAnalytics?: boolean }
): Promise<string | null> {
  const preload = await loadWorkspaceSnapshotPreload(ctx);
  return preload ? formatWorkspaceServerSnapshotBlock(preload, options) : null;
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
          symbols: wl.symbols.map((s) =>
            s.entryPrice === undefined
              ? s
              : {
                  ...s,
                  targetEntryPrice: s.entryPrice
                }
          )
        };

  // Calculate total portfolio value and create allocation chart
  const totalCashBalance = j.accounts.reduce((sum: number, account) => sum + account.cashBalance, 0);
  const totalPositionValue = j.positionsPreview.reduce((sum: number, pos) => sum + Math.abs(pos.qty * pos.avgCost), 0);
  const totalPortfolioValue = totalCashBalance + totalPositionValue;

  // Create allocation chart using the same function
  const allocationChart = createPortfolioAllocationChart(j.positionsPreview, totalCashBalance);

  return {
    name: j.portfolio.name,
    isDefault: j.portfolio.isDefault,
    accountCount: j.accounts.length,
    totalPositionCount: j.portfolio.totalPositionCount,
    totalValue: totalPortfolioValue,
    ...(j.bookTailRisk ? { bookTailRisk: j.bookTailRisk } : {}),
    ...(j.investmentOutlook && j.investmentOutlook.symbols.length > 0
      ? {
          investmentOutlook: {
            symbolCount: j.investmentOutlook.symbols.length,
            updatedAt: j.investmentOutlook.updatedAt,
            expiresAt: j.investmentOutlook.expiresAt,
            symbols: j.investmentOutlook.symbols
          }
        }
      : {}),
    allocationChart,
    accounts: j.accounts.map((a) => ({
      name: a.name,
      type: a.type,
      extAccountId: maskAccountXrefForDisplay(a.extAccountId),
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
      extAccountId: maskAccountXrefForDisplay(a.extAccountId),
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
        avgCost: r.avgCost,
        type: r.positionType ?? "stock"
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
