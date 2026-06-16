import { createHash } from "node:crypto";

import { maskAccountXrefForDisplay } from "@/lib/account-xref-display";
import { parsePortfolioAlertUserPriceRuleMetadata } from "@/lib/portfolio-alert-user-price-rule-metadata";
import type { ToolExecutor } from "@/lib/xai";
import { createAuditEvent } from "@/modules/audit/repository";
import {
    adminListPortfolioAlerts,
    DEFAULT_ACCOUNT_CASH_BALANCE,
    ensurePortfolioWatchlistForUser,
    getDefaultPortfolio,
    getPortfolioByIdForSessionUser,
    getUserWatchlist,
    listPortfolioAccounts,
    listPortfolioPositionsByAccount,
    listScheduledTasks,
    listTaskRuns,
    mutatePortfolioWatchlistSymbols,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import type { AccountOutlook, WatchlistSymbol } from "@/modules/core-admin/types";
import { parseAccountOutlook } from "@/modules/core-admin/types";
import { ensureUserAlertManagerScheduledTaskForTenant } from "@/modules/price-alerts/ensure-user-alert-manager-task";
import { migrateLegacyNlPriceAlertsIfNeeded } from "@/modules/price-alerts/migrate-legacy-nl-price-alerts";
import { MAX_NL_USER_PRICE_ALERT_RULES } from "@/modules/price-alerts/nl-price-alert-limits";
import {
    countActivePortfolioPriceAlertsForTenant,
    deleteActivePortfolioPriceAlertForUserSymbol,
    deleteAllActivePortfolioPriceAlertsForUser,
    listActivePortfolioPriceAlertsForUser,
    upsertActivePortfolioPriceAlert
} from "@/modules/price-alerts/portfolio-price-alerts-repository";
import { resolvePortfolioHintFromNl } from "@/modules/price-alerts/resolve-portfolio-hint";
import { fetchYahooOptionChainForExpiration } from "@/modules/strategy-options/options-chain";
import {
    WATCHLIST_ENTRY_DEFAULT_LINE_TYPE,
    WATCHLIST_ENTRY_DEFAULT_STRATEGY,
    WATCHLIST_UPSERT_DEFAULT_OUTLOOK,
    WATCHLIST_UPSERT_DEFAULT_RISK_PROFILE
} from "@/modules/watchlist/default-upsert-fields";
import { resolveLiveQuotesForWatchlistSymbols } from "@/modules/watchlist/watchlist-live-quotes";
import { getYahooMarketQuote } from "@/modules/xchat/market-data";
import { runMonteCarloTailRiskTool } from "@/modules/xchat/monte-carlo-tail-risk-tool";
import { buildOptionsActionReport } from "@/modules/xchat/options-action-scan";
import {
    filterOptionsScanLegsForDesk,
    parseMaxCollateralUsdFromText,
    rankOptionsScanLegsForDesk,
    type OptionsScanDeskLeg
} from "@/modules/xchat/options-scan-ranking";
import {
    buildOptionsScanFingerprint,
    setOptionsScanCache,
    tryGetOptionsScanCache
} from "@/modules/xchat/options-scan-redis-cache";
import { canManageNlPriceAlerts } from "@/modules/xchat/plan-limits";
import { runStrategyRecommendationsTool } from "@/modules/xchat/strategy-recommendations-tool";
import {
    deleteCachedToolResult,
    getCachedToolResult,
    setCachedToolResult
} from "@/modules/xchat/tool-cache";
import {
    ATXFINANCE_TOOL_DEFINITION,
    YAHOO_FINANCE_TOOL_DEFINITION
} from "@/modules/xchat/tool-definitions";
import { loadUserWorkspaceSummaryForPrompt } from "@/modules/xchat/user-workspace-summary-for-prompt";
import {
    formatWatchlistAddedAtUtc,
    formatWatchlistSpotPriceUsd,
    formatWatchlistTargetEntryNotional100xFromQuotePrice,
    formatWatchlistTargetEntryNotional100xUsd,
    formatWatchlistTargetEntryStored
} from "@/modules/xchat/watchlist-prompt-format";
import {
    accountHealthFromWorkspacePreload,
    loadWorkspaceSnapshotPreload,
    portfolioSummaryFromWorkspacePreload,
    positionsSnapshotFromWorkspacePreload,
    type WorkspaceSnapshotContext,
    type WorkspaceSnapshotPreload
} from "@/modules/xchat/workspace-snapshot-for-prompt";
import { getYahooFinance2 } from "@/modules/yahoo/yahoo-finance-service";

export type {
    WorkspaceSnapshotContext,
    WorkspaceSnapshotPreload
} from "@/modules/xchat/workspace-snapshot-for-prompt";

const MAX_OUTPUT_BYTES = 8 * 1024;
/** Cap rows returned by positions_snapshot before JSON serialization (freshness; not cached). */
const MAX_POSITIONS_RETURNED = 200;
/** Watchlist quotes are refreshed per request — do not cache snapshot JSON (stale Spot dashes). */
const CACHEABLE_OPERATIONS = new Set(["account_health"]);

/**
 * Skip byte-cap truncation — it can slice UTF-8 mid-sequence and yields invalid JSON.
 * `options_action_scan` / `watchlist_snapshot` are parsed by `/api/xchat/ask` direct paths; options rows are capped in `buildOptionsActionReport`.
 */
const NO_TRUNCATE_JSON_OPERATIONS = new Set([
  "options_action_scan",
  "options_scan",
  "monte_carlo_tail_risk",
  "watchlist_snapshot"
]);

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
/** Matches PATCH `/api/portfolios/:id/watchlist` batch size. */
const MAX_WATCHLIST_MUTATE_PER_CALL = 20;

const PRELOAD_SHORT_CIRCUIT_OPS = new Set([
  "portfolio_summary",
  "account_health",
  "positions_snapshot"
  /** watchlist_snapshot omitted — preload JSON omits live Yahoo marks; always run loadWatchlistSummary. */
]);

function watchlistSymbolToJson(s: WatchlistSymbol, quotePrice?: number) {
  const hasEntryPrice = s.entryPrice !== undefined;
  const addedAtIso = s.addedAt instanceof Date ? s.addedAt.toISOString() : String(s.addedAt);
  return {
    symbol: s.symbol,
    addedAt: addedAtIso,
    addedAtDisplay: formatWatchlistAddedAtUtc(addedAtIso),
    spotPriceDisplay: formatWatchlistSpotPriceUsd(quotePrice),
    targetEntryNotional100xUsdDisplay: formatWatchlistTargetEntryNotional100xUsd(quotePrice),
    ...(s.lineType !== undefined ? { lineType: s.lineType } : {}),
    ...(s.strategy !== undefined ? { strategy: s.strategy } : {}),
    ...(s.quantity !== undefined ? { quantity: s.quantity } : {}),
    ...(s.rationale !== undefined ? { rationale: s.rationale } : {}),
    ...(s.rowStatus !== undefined ? { rowStatus: s.rowStatus } : {}),
    ...(hasEntryPrice ? { entryPrice: s.entryPrice } : {}),
    ...(hasEntryPrice ? { targetEntryPrice: s.entryPrice } : {}),
    targetEntryDisplay: formatWatchlistTargetEntryStored(s.entryPrice),
    targetEntryNotional100xDisplay: formatWatchlistTargetEntryNotional100xFromQuotePrice(quotePrice)
  };
}

type WatchlistSummaryPayload =
  | { error: "no_watchlist" }
  | { name: string; symbolCount: number; symbols: ReturnType<typeof watchlistSymbolToJson>[] };

async function loadWatchlistSummary(ctx: ExecutorContext): Promise<WatchlistSummaryPayload> {
  let watchlist = await getUserWatchlist({
    userId: ctx.userId,
    tenantId: ctx.tenantId
  });
  if (!watchlist) {
    const portfolio = await getDefaultPortfolioOrProvision(ctx);
    if (portfolio?._id) {
      await ensurePortfolioWatchlistForUser({
        userId: ctx.userId,
        portfolioId: portfolio._id.toHexString(),
        tenantId: ctx.tenantId
      });
      watchlist = await getUserWatchlist({ userId: ctx.userId, tenantId: ctx.tenantId });
    }
  }
  if (!watchlist) {
    return { error: "no_watchlist" };
  }
  const symbols = watchlist.symbols ?? [];
  const upperSyms = symbols.map((x) => x.symbol.trim().toUpperCase());
  const liveBySymbol =
    upperSyms.length > 0
      ? await resolveLiveQuotesForWatchlistSymbols(upperSyms, { allowNetwork: true })
      : new Map();
  return {
    name: watchlist.name,
    symbolCount: symbols.length,
    symbols: symbols.map((s) => watchlistSymbolToJson(s, liveBySymbol.get(s.symbol.trim().toUpperCase())?.price))
  };
}

function watchlistSnapshotFromWorkspacePreload(p: WorkspaceSnapshotPreload): Record<string, unknown> {
  const wl = p.promptJson.watchlist;
  if ("error" in wl) {
    return { error: "no_watchlist" as const };
  }
  const symbols = wl.symbols.map((s) => ({
    ...s,
    ...(s.entryPrice !== undefined ? { targetEntryPrice: s.entryPrice } : {})
  }));
  return {
    name: wl.name,
    symbolCount: symbols.length,
    symbols
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

type ToolOptionsScanFilters = {
  optionType: "call" | "put";
  minDte: number;
  maxDte: number;
  minAbsDelta: number | null;
  maxAbsDelta: number | null;
  minIvPct: number | null;
  minOi: number | null;
  minBid: number | null;
  maxCollateralUsd: number | null;
  referencePrice: number | null;
};

type ToolOptionsScanLeg = OptionsScanDeskLeg;

function parseNumberArg(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === "string") {
    const n = Number.parseFloat(v.trim());
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return null;
}

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function daysToExpirationUtc(yyyyMmDd: string): number {
  const exp = new Date(`${yyyyMmDd.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(exp.getTime())) {
    return Number.POSITIVE_INFINITY;
  }
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const expUtc = Date.UTC(exp.getUTCFullYear(), exp.getUTCMonth(), exp.getUTCDate());
  return Math.max(0, Math.ceil((expUtc - todayUtc) / 86400000));
}

function normalizeExpirationDateToken(raw: Date | string): string | null {
  const parsed = raw instanceof Date ? raw : new Date(raw);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }
  const y = parsed.getUTCFullYear();
  const m = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const d = String(parsed.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseOptionType(v: unknown): "call" | "put" | null {
  if (typeof v !== "string") {
    return null;
  }
  const s = v.trim().toLowerCase();
  if (s === "call" || s === "calls") {
    return "call";
  }
  if (s === "put" || s === "puts") {
    return "put";
  }
  return null;
}

function parseScanQueryFilters(query: string): Partial<ToolOptionsScanFilters> {
  const q = query.trim().toLowerCase();
  if (!q) {
    return {};
  }
  const out: Partial<ToolOptionsScanFilters> = {};

  if (/\bputs?\b/.test(q)) {
    out.optionType = "put";
  } else if (/\bcalls?\b/.test(q)) {
    out.optionType = "call";
  }

  const dteMax = q.match(/\bdte\s*(?:<=|<|=)\s*(\d{1,3})\b/);
  if (dteMax) {
    out.maxDte = clampInt(Number.parseInt(dteMax[1]!, 10), 0, 365);
  }
  const dteMin = q.match(/\bdte\s*(?:>=|>)\s*(\d{1,3})\b/);
  if (dteMin) {
    out.minDte = clampInt(Number.parseInt(dteMin[1]!, 10), 0, 365);
  }

  const deltaRange = q.match(/\bdelta\b[^\d-]*([0-9]*\.?[0-9]+)\s*[-to]+\s*([0-9]*\.?[0-9]+)/);
  if (deltaRange) {
    const a = Number.parseFloat(deltaRange[1]!);
    const b = Number.parseFloat(deltaRange[2]!);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      out.minAbsDelta = Math.max(0, Math.min(a, b));
      out.maxAbsDelta = Math.min(1, Math.max(a, b));
    }
  } else {
    const deltaMin = q.match(/\bdelta\s*(?:>=|>)\s*([0-9]*\.?[0-9]+)/);
    const deltaMax = q.match(/\bdelta\s*(?:<=|<)\s*([0-9]*\.?[0-9]+)/);
    if (deltaMin) {
      const v = Number.parseFloat(deltaMin[1]!);
      if (Number.isFinite(v)) {
        out.minAbsDelta = Math.max(0, Math.min(1, v));
      }
    }
    if (deltaMax) {
      const v = Number.parseFloat(deltaMax[1]!);
      if (Number.isFinite(v)) {
        out.maxAbsDelta = Math.max(0, Math.min(1, v));
      }
    }
  }

  const ivMin = q.match(/\b(?:iv|vol(?:atility)?)\s*(?:>=|>)\s*([0-9]*\.?[0-9]+)/);
  if (ivMin) {
    const v = Number.parseFloat(ivMin[1]!);
    if (Number.isFinite(v)) {
      out.minIvPct = Math.max(0, v);
    }
  }

  const oiMin = q.match(/\b(?:oi|open\s*interest)\s*(?:>=|>)\s*(\d+(?:\.\d+)?)\b/);
  if (oiMin) {
    const v = Number.parseFloat(oiMin[1]!);
    if (Number.isFinite(v)) {
      out.minOi = Math.max(0, v);
    }
  }

  const bidMin = q.match(/\bbid\s*(?:>=|>)\s*([0-9]*\.?[0-9]+)/);
  if (bidMin) {
    const v = Number.parseFloat(bidMin[1]!);
    if (Number.isFinite(v)) {
      out.minBid = Math.max(0, v);
    }
  }

  return out;
}

function buildOptionsScanFilters(args: Record<string, unknown>): ToolOptionsScanFilters {
  const parsedFromQuery =
    typeof args.query === "string" ? parseScanQueryFilters(args.query) : {};
  const optionType =
    parseOptionType(args.optionType) ??
    parseOptionType(args.contractType) ??
    parsedFromQuery.optionType ??
    "put";
  const minDteArg = parseNumberArg(args.minDte);
  const maxDteArg = parseNumberArg(args.maxDte);
  const minDte = clampInt(
    minDteArg ?? parsedFromQuery.minDte ?? 0,
    0,
    365
  );
  const maxDte = clampInt(
    maxDteArg ?? parsedFromQuery.maxDte ?? 7,
    0,
    365
  );
  const minAbsDelta = parseNumberArg(args.minDelta) ?? parsedFromQuery.minAbsDelta ?? null;
  const maxAbsDelta = parseNumberArg(args.maxDelta) ?? parsedFromQuery.maxAbsDelta ?? null;
  const minIvPct =
    parseNumberArg(args.minIvPct) ??
    parseNumberArg(args.minVolPct) ??
    parseNumberArg(args.ivMinPct) ??
    parsedFromQuery.minIvPct ??
    null;
  const minOi =
    parseNumberArg(args.minOi) ??
    parseNumberArg(args.minOpenInterest) ??
    parsedFromQuery.minOi ??
    null;
  const minBid = parseNumberArg(args.minBid) ?? parsedFromQuery.minBid ?? null;
  const queryText = typeof args.query === "string" ? args.query : "";
  const maxCollateralUsd =
    parseNumberArg(args.maxCollateralUsd) ??
    parseNumberArg(args.maxCashUsd) ??
    parseMaxCollateralUsdFromText(queryText) ??
    null;
  const referencePrice =
    parseNumberArg(args.referencePrice) ??
    parseNumberArg(args.costBasis) ??
    parseNumberArg(args.entryPrice) ??
    null;
  return {
    optionType,
    minDte: Math.min(minDte, maxDte),
    maxDte: Math.max(minDte, maxDte),
    minAbsDelta: minAbsDelta != null ? Math.max(0, Math.min(1, minAbsDelta)) : null,
    maxAbsDelta: maxAbsDelta != null ? Math.max(0, Math.min(1, maxAbsDelta)) : null,
    minIvPct: minIvPct != null ? Math.max(0, minIvPct) : null,
    minOi: minOi != null ? Math.max(0, minOi) : null,
    minBid: minBid != null ? Math.max(0, minBid) : null,
    maxCollateralUsd: maxCollateralUsd != null && maxCollateralUsd > 0 ? maxCollateralUsd : null,
    referencePrice: referencePrice != null && referencePrice > 0 ? referencePrice : null
  };
}

async function resolveSymbolCostBasisForScan(
  ctx: ExecutorContext,
  symbol: string
): Promise<number | null> {
  const portfolio = await getDefaultPortfolioOrProvision(ctx);
  if (!portfolio?._id) {
    return null;
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
    return null;
  }
  const positions = await listPortfolioPositionsByAccount({
    userId: ctx.userId,
    portfolioId,
    accountIds,
    tenantId: ctx.tenantId
  });
  const sym = symbol.trim().toUpperCase();
  for (const p of positions) {
    if (p.symbol?.trim().toUpperCase() !== sym) {
      continue;
    }
    if (p.optionType != null) {
      continue;
    }
    if (typeof p.avgCost === "number" && Number.isFinite(p.avgCost) && p.avgCost > 0) {
      return p.avgCost;
    }
  }
  return null;
}

function legPassesToolScanFilters(leg: ToolOptionsScanLeg, filters: ToolOptionsScanFilters): boolean {
  if (leg.optionType !== filters.optionType) {
    return false;
  }
  if (leg.dte < filters.minDte || leg.dte > filters.maxDte) {
    return false;
  }
  if (filters.minIvPct != null && leg.ivPct < filters.minIvPct) {
    return false;
  }
  if (filters.minOi != null && leg.openInterest < filters.minOi) {
    return false;
  }
  if (filters.minBid != null && leg.bid < filters.minBid) {
    return false;
  }
  if (filters.minAbsDelta != null && (leg.deltaAbs == null || leg.deltaAbs < filters.minAbsDelta)) {
    return false;
  }
  if (filters.maxAbsDelta != null && (leg.deltaAbs == null || leg.deltaAbs > filters.maxAbsDelta)) {
    return false;
  }
  return true;
}

export type XfinanceToolExecutorContext = {
  userId: string;
  tenantId?: string;
  subscriptionPlan?: "basic" | "premium" | "premium_plus";
  /** Platform roles from session — NL price alerts require advisor or global_admin with Premium+. */
  platformRoles?: string[];
  /** Raw request cookie forwarded to Spring for session-scoped engine tools. */
  sessionCookie?: string;
  workspacePortfolioId?: string | null;
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

function buildOperations(
  invalidateWorkspacePreload: () => void,
  cacheScopeKey: string
): Record<string, OperationHandler> {
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
      const watchlist = await loadWatchlistSummary(ctx);

      // Calculate total portfolio value for allocation chart
      const totalCashBalance = accounts.reduce((sum, account) =>
        sum + (account.cashBalance ?? DEFAULT_ACCOUNT_CASH_BALANCE), 0
      );
      const totalPositionValue = positions.reduce((sum, pos) =>
        sum + Math.abs(pos.qty * pos.avgCost), 0
      );
      const totalPortfolioValue = totalCashBalance + totalPositionValue;

      // Create allocation chart
      const allocationChart = createPortfolioAllocationChart(positions, totalCashBalance);

      return {
        name: portfolio.name,
        isDefault: portfolio.isDefault,
        accountCount: accounts.length,
        totalPositionCount: positions.length,
        totalValue: totalPortfolioValue,
        allocationChart,
        accounts: accounts.map((a) => ({
          name: a.name,
          type: a.type,
          extAccountId: maskAccountXrefForDisplay(a.extAccountId),
          isDefault: a.isDefault,
          cashBalance: a.cashBalance ?? DEFAULT_ACCOUNT_CASH_BALANCE,
          positionCount: a._id ? (counts.get(a._id.toHexString()) ?? 0) : 0
        })),
        watchlist
      };
    },

    user_workspace_summary: async (_args, ctx) => {
      return (
        (await loadUserWorkspaceSummaryForPrompt({
          userId: ctx.userId,
          tenantId: ctx.tenantId,
          workspacePortfolioId: ctx.workspacePortfolioId
        })) ?? { error: "no_portfolios" }
      );
    },

    watchlist_snapshot: async (_args, ctx) => {
      return loadWatchlistSummary(ctx);
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
      deleteCachedToolResult(ctx.userId, "watchlist_snapshot", cacheScopeKey);
      deleteCachedToolResult(ctx.userId, "account_health", cacheScopeKey);
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
      deleteCachedToolResult(ctx.userId, "watchlist_snapshot", cacheScopeKey);
      deleteCachedToolResult(ctx.userId, "account_health", cacheScopeKey);
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
          extAccountId: maskAccountXrefForDisplay(a.extAccountId),
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

    options_scan: async (args, ctx: ExecutorContext) => {
      const symbol =
        typeof args.underlying === "string"
          ? args.underlying.trim().toUpperCase()
          : typeof args.symbol === "string"
            ? args.symbol.trim().toUpperCase()
            : "";
      if (!symbol || !/^[A-Z0-9.\-]{1,12}$/.test(symbol)) {
        return {
          error: "invalid_symbol",
          hint: "Provide a valid symbol via `symbol` or `underlying`, e.g. `RDW`."
        };
      }

      const filters = buildOptionsScanFilters(args);
      const fingerprint = buildOptionsScanFingerprint({ symbol, filters });
      const cachedScan = await tryGetOptionsScanCache(fingerprint);
      if (cachedScan) {
        try {
          return JSON.parse(cachedScan) as Record<string, unknown>;
        } catch {
          /* ignore bad cache */
        }
      }

      const yahoo = getYahooFinance2();
      let expirationDates: string[] = [];
      try {
        const optionsResult = (await yahoo.options(symbol)) as { expirationDates?: Array<Date | string> };
        expirationDates = (optionsResult.expirationDates ?? [])
          .map(normalizeExpirationDateToken)
          .filter((x): x is string => typeof x === "string");
      } catch {
        expirationDates = [];
      }
      if (expirationDates.length === 0) {
        return {
          symbol,
          spot: null,
          criteria: filters,
          examined: 0,
          matched: 0,
          rows: [],
          note: "No option expiration dates available from Yahoo for this symbol."
        };
      }

      const quote = await getYahooMarketQuote({ symbol }).catch(() => null);
      const spot =
        quote && typeof quote.price === "number" && Number.isFinite(quote.price) ? quote.price : null;
      const expInRange = expirationDates
        .map((exp) => ({ exp, dte: daysToExpirationUtc(exp) }))
        .filter((x) => x.dte >= filters.minDte && x.dte <= filters.maxDte)
        .sort((a, b) => a.dte - b.dte)
        .slice(0, 8);

      if (expInRange.length === 0) {
        return {
          symbol,
          spot,
          criteria: filters,
          examined: 0,
          matched: 0,
          rows: [],
          note: "No expirations found within requested DTE bounds."
        };
      }

      const allLegs: ToolOptionsScanLeg[] = [];
      for (const { exp, dte } of expInRange) {
        const stockPrice = spot ?? 0;
        const chain = await fetchYahooOptionChainForExpiration(symbol, exp, stockPrice, Math.max(1, dte));
        if (!chain?.optionChain?.length) {
          continue;
        }
        for (const row of chain.optionChain) {
          const leg = filters.optionType === "put" ? row.put : row.call;
          if (!leg) {
            continue;
          }
          const bid = leg.last_quote?.bid;
          const ask = leg.last_quote?.ask;
          if (
            typeof bid !== "number" ||
            !Number.isFinite(bid) ||
            typeof ask !== "number" ||
            !Number.isFinite(ask)
          ) {
            continue;
          }
          const ivPct = typeof leg.implied_volatility === "number" && Number.isFinite(leg.implied_volatility)
            ? leg.implied_volatility
            : 0;
          const oi = typeof leg.open_interest === "number" && Number.isFinite(leg.open_interest)
            ? leg.open_interest
            : 0;
          const deltaRaw =
            typeof leg.greeks?.delta === "number" && Number.isFinite(leg.greeks.delta)
              ? leg.greeks.delta
              : null;
          allLegs.push({
            expiration: exp,
            dte,
            strike: row.strike,
            optionType: filters.optionType,
            bid,
            ask,
            mid: (bid + ask) / 2,
            ivPct,
            openInterest: oi,
            deltaAbs: deltaRaw == null ? null : Math.abs(deltaRaw),
            deltaRaw
          });
        }
      }

      const matched = allLegs.filter((leg) => legPassesToolScanFilters(leg, filters));
      const costBasis =
        filters.referencePrice ??
        (await resolveSymbolCostBasisForScan(ctx, symbol).catch(() => null));
      const deskContext = {
        spot,
        referencePrice: costBasis,
        maxCollateralUsd: filters.maxCollateralUsd
      };
      const deskLegs = filterOptionsScanLegsForDesk(matched, filters.optionType, deskContext);
      const ranked = rankOptionsScanLegsForDesk(deskLegs, filters.optionType, deskContext);
      const rows = ranked.slice(0, 40);

      let note: string | undefined;
      if (rows.length === 0 && matched.length > 0) {
        note =
          "Contracts matched DTE/IV/OI filters but none were near spot/cost basis (or within collateral budget). Try widening OTM band or DTE.";
      } else if (rows.length === 0) {
        note = "No contracts matched all active filters. Loosen one threshold and retry.";
      }

      const payload = {
        symbol,
        spot,
        referencePrice: costBasis,
        criteria: filters,
        expirationsExamined: expInRange.map((x) => ({ expiration: x.exp, dte: x.dte })),
        examined: allLegs.length,
        matched: rows.length,
        matchedBeforeDeskFilter: matched.length,
        rows,
        note
      };
      void setOptionsScanCache(fingerprint, JSON.stringify(payload)).catch(() => {
        /* non-fatal */
      });
      return payload;
    },

    options_action_scan: async (_args, ctx: ExecutorContext) => {
      const report = await buildOptionsActionReport({
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        subscriptionPlan: ctx.subscriptionPlan,
        workspacePortfolioId: ctx.workspacePortfolioId
      });
      return {
        generatedAt: report.generatedAt,
        planTier: report.planTier,
        truncated: report.truncated,
        rowCount: report.rows.length,
        rows: report.rows,
        disclaimer: report.disclaimer
      };
    },

    strategy_recommendations: async (args, ctx: ExecutorContext) => {
      return runStrategyRecommendationsTool(args, {
        sessionCookie: ctx.sessionCookie,
        workspacePortfolioId: ctx.workspacePortfolioId
      });
    },

    monte_carlo_tail_risk: async (args, ctx: ExecutorContext) => {
      return runMonteCarloTailRiskTool(args, {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        workspacePortfolioId: ctx.workspacePortfolioId
      });
    },

    price_alert_manage: async (args, ctx: ExecutorContext) => {
      if (!canManageNlPriceAlerts(ctx.subscriptionPlan, ctx.platformRoles)) {
        return {
          error: "plan_blocked_nl_price_alerts",
          message:
            "Natural-language price alerts require Premium+ with an advisor seat (global admins included). Use Portfolio → Alerts or upgrade.",
          alertsDeepLink: "/portfolio/alerts"
        };
      }

      const workspacePf = await getDefaultPortfolioOrProvision(ctx);
      if (!workspacePf?._id) {
        return { error: "no_default_portfolio" };
      }
      const workspacePortfolioIdHex = workspacePf._id.toHexString();
      const workspaceAlertsDeepLink = `/portfolio/alerts?portfolioId=${encodeURIComponent(workspacePortfolioIdHex)}`;

      const op = typeof args.priceAlertOp === "string" ? args.priceAlertOp.trim() : "";

      const auditNl = (action: string, entityId: string, details: Record<string, unknown>) => {
        void createAuditEvent({
          entityType: "portfolio_price_alert",
          entityId,
          action,
          actor: { userId: ctx.userId },
          details
        }).catch(() => {});
      };

      if (op === "list") {
        await migrateLegacyNlPriceAlertsIfNeeded({
          userId: ctx.userId,
          tenantId: ctx.tenantId
        });
        const active = await listActivePortfolioPriceAlertsForUser({
          userId: ctx.userId,
          tenantId: ctx.tenantId
        });
        const rows = await adminListPortfolioAlerts(workspacePortfolioIdHex);
        const recentDesk: Array<{ id: string; title: string; symbol: string | null }> = [];
        for (const r of rows) {
          const meta = parsePortfolioAlertUserPriceRuleMetadata(r.metadata);
          if (meta?.ruleState === "armed") {
            continue;
          }
          if (recentDesk.length < 8) {
            recentDesk.push({
              id: r._id?.toHexString() ?? "",
              title: r.title,
              symbol: r.symbol ?? null
            });
          }
        }
        auditNl("xchat_nl_price_alert_list", ctx.userId, { activeCount: active.length });
        return {
          portfolioId: workspacePortfolioIdHex,
          alertsDeepLink: workspaceAlertsDeepLink,
          activeAlertCount: active.length,
          activeAlerts: active.map((a) => ({
            id: a._id?.toHexString(),
            symbol: a.symbolNorm,
            ruleKind: a.ruleKind,
            targetPriceUsd: a.targetPriceUsd,
            portfolioId: a.portfolioId.toHexString(),
            portfolioName: a.portfolioName,
            expiresAt: a.expiresAt.toISOString()
          })),
          recentDeskAlerts: recentDesk,
          note:
            "Active alerts live in portfolio_price_alerts (one per symbol per user). Evaluated on tenant watchlist scans plus the user_alert_manager scheduled task."
        };
      }

      if (op === "add") {
        const portfolioHintRaw =
          (typeof args.portfolioHint === "string" && args.portfolioHint.trim()) ||
          (typeof args.portfolioName === "string" && args.portfolioName.trim()) ||
          (typeof args.inPortfolio === "string" && args.inPortfolio.trim()) ||
          undefined;

        const resolvedPf = await resolvePortfolioHintFromNl({
          userId: ctx.userId,
          tenantId: ctx.tenantId,
          portfolioHint: portfolioHintRaw,
          workspacePortfolioId: ctx.workspacePortfolioId
        });
        if (!resolvedPf.ok) {
          return {
            error:
              resolvedPf.error === "ambiguous" ? "portfolio_hint_ambiguous" : "portfolio_hint_not_found",
            candidates: resolvedPf.candidates,
            alertsDeepLink: workspaceAlertsDeepLink
          };
        }
        const portfolioId = resolvedPf.portfolioIdHex;
        const alertsDeepLink = `/portfolio/alerts?portfolioId=${encodeURIComponent(portfolioId)}`;

        const tickers = parseTickerListFromArgs(args, 1);
        const rawSym =
          tickers[0] ?? (typeof args.symbol === "string" ? args.symbol.trim().toUpperCase() : "");
        const validSym = /^[A-Z0-9.\-]{1,32}$/.test(rawSym) ? rawSym : "";
        if (!validSym) {
          return { error: "invalid_symbol", alertsDeepLink };
        }
        const target =
          parseNumberArg(args.targetPrice) ??
          parseNumberArg(args.price) ??
          parseNumberArg(args.level);
        if (target == null || target <= 0 || target > 1_000_000) {
          return { error: "invalid_target_price", alertsDeepLink };
        }

        const rk = typeof args.ruleKind === "string" ? args.ruleKind.trim().toLowerCase() : "";
        let ruleKind: "above" | "below" | "crosses" | null = null;
        if (rk === "above" || rk === "below" || rk === "crosses") {
          ruleKind = rk;
        }
        if (ruleKind == null) {
          return {
            error: "needs_rule_kind_clarification",
            message:
              "Say whether you want the alert when price goes **above**, **below**, or **crosses** the target.",
            examples: [
              "add alert TSLA 420 above",
              "add alert NVDA 140 below",
              "add alert AMD 175 crosses",
              "add alert RKLB 25 above in my Roth account"
            ],
            alertsDeepLink
          };
        }

        const activeBefore = await listActivePortfolioPriceAlertsForUser({
          userId: ctx.userId,
          tenantId: ctx.tenantId
        });
        const hadSymbol = activeBefore.some((a) => a.symbolNorm === validSym);
        if (!hadSymbol && activeBefore.length >= MAX_NL_USER_PRICE_ALERT_RULES) {
          return {
            error: "nl_price_alert_rule_cap",
            max: MAX_NL_USER_PRICE_ALERT_RULES,
            alertsDeepLink
          };
        }

        const tenantBefore = ctx.tenantId
          ? await countActivePortfolioPriceAlertsForTenant(ctx.tenantId)
          : 0;

        const { doc, replaced } = await upsertActivePortfolioPriceAlert({
          userId: ctx.userId,
          tenantId: ctx.tenantId,
          portfolioIdHex: portfolioId,
          portfolioName: resolvedPf.portfolioName,
          symbolUpper: validSym,
          targetPriceUsd: target,
          ruleKind,
          preserveLastReference: true
        });

        if (!doc?._id) {
          return { error: "create_failed", alertsDeepLink };
        }

        if (ctx.tenantId) {
          const tenantAfter = await countActivePortfolioPriceAlertsForTenant(ctx.tenantId);
          if (tenantBefore === 0 && tenantAfter > 0) {
            await ensureUserAlertManagerScheduledTaskForTenant(ctx.tenantId);
          }
        }

        invalidateWorkspacePreload();
        auditNl("xchat_nl_price_alert_add", doc._id.toHexString(), {
          symbol: validSym,
          targetPriceUsd: target,
          ruleKind,
          portfolioId,
          replaced
        });

        let spotNote: string | undefined;
        try {
          const q = await getYahooMarketQuote({ symbol: validSym });
          const px = q.price;
          if (typeof px === "number" && Number.isFinite(px)) {
            spotNote = `Spot ~ $${px.toFixed(2)} (Yahoo).`;
          }
        } catch {
          /* ignore */
        }

        return {
          ok: true,
          portfolioId,
          alertsDeepLink,
          ruleDocId: doc._id.toHexString(),
          symbol: validSym,
          targetPriceUsd: target,
          ruleKind,
          replaced,
          spotNote,
          deliveryNote:
            "When this rule fires, we create a portfolio desk alert and may send Premium+ advisor branded email when desk SMTP is configured."
        };
      }

      if (op === "remove_symbol") {
        const tickers = parseTickerListFromArgs(args, 1);
        const rawSym =
          tickers[0] ?? (typeof args.symbol === "string" ? args.symbol.trim().toUpperCase() : "");
        const validSym = /^[A-Z0-9.\-]{1,32}$/.test(rawSym) ? rawSym : "";
        if (!validSym) {
          return { error: "invalid_symbol", alertsDeepLink: workspaceAlertsDeepLink };
        }
        if (args.confirmDestructive !== true) {
          return {
            needs_confirmation: true,
            alertsDeepLink: workspaceAlertsDeepLink,
            summary: `Remove your active NL price alert for ${validSym} (one alert per symbol for your user).`,
            instruction:
              "After the user confirms in chat, call again with confirmDestructive true (same symbol)."
          };
        }
        const n = await deleteActivePortfolioPriceAlertForUserSymbol({
          userId: ctx.userId,
          tenantId: ctx.tenantId,
          symbolUpper: validSym
        });
        invalidateWorkspacePreload();
        auditNl("xchat_nl_price_alert_remove_symbol", ctx.userId, { symbol: validSym, deleted: n });
        return {
          ok: true,
          portfolioId: workspacePortfolioIdHex,
          alertsDeepLink: workspaceAlertsDeepLink,
          deletedRules: n,
          symbol: validSym
        };
      }

      if (op === "clear_all") {
        if (args.confirmDestructive !== true) {
          return {
            needs_confirmation: true,
            alertsDeepLink: workspaceAlertsDeepLink,
            summary:
              "Remove every active NL price alert you created via xChat (desk scanner rows stay).",
            instruction: "After explicit user confirmation, retry with confirmDestructive true."
          };
        }
        const n = await deleteAllActivePortfolioPriceAlertsForUser({
          userId: ctx.userId,
          tenantId: ctx.tenantId
        });
        invalidateWorkspacePreload();
        auditNl("xchat_nl_price_alert_clear_all", ctx.userId, { deleted: n });
        return {
          ok: true,
          portfolioId: workspacePortfolioIdHex,
          alertsDeepLink: workspaceAlertsDeepLink,
          deletedRules: n
        };
      }

      return {
        error: "invalid_price_alert_op",
        priceAlertOp: op || null,
        alertsDeepLink: workspaceAlertsDeepLink
      };
    },

    market_quote: async (args, ctx: ExecutorContext) => {
      void ctx;
      const symbol =
        typeof args.symbol === "string" && args.symbol.trim()
          ? args.symbol.trim()
          : typeof args.ticker === "string" && args.ticker.trim()
            ? args.ticker.trim()
            : Array.isArray(args.symbols) && typeof args.symbols[0] === "string" && args.symbols[0].trim()
              ? args.symbols[0].trim()
              : undefined;
      try {
        return await getYahooMarketQuote({ symbol });
      } catch (error) {
        const sym = (symbol ?? "TSLA").trim().toUpperCase();
        return {
          error: "quote_unavailable",
          symbol: sym,
          message:
            "Yahoo Finance returned an error. Try again in a moment or check your atx workspace.",
          detail: error instanceof Error ? error.message : String(error)
        };
      }
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

/** Per-request fingerprint for dedup tracker (`op:argsHash`). */
function buildPerRequestFingerprint(operation: string, args: Record<string, unknown>): string {
  let argsJson: string;
  try {
    argsJson = JSON.stringify(args ?? {});
  } catch {
    argsJson = "{}";
  }
  return `${operation}:${createHash("sha256").update(argsJson).digest("hex").slice(0, 24)}`;
}

/** Empty-book guard: if covered-call options_scan is requested and the book has zero positions, steer the model off Yahoo. */
function buildEmptyBookCoveredCallGuard(input: {
  args: Record<string, unknown>;
  preload: WorkspaceSnapshotPreload | null;
}): Record<string, unknown> | null {
  const { args, preload } = input;
  if (!preload || preload.promptJson.portfolio.totalPositionCount > 0) {
    return null;
  }
  const optionType =
    parseOptionType(args.optionType) ?? parseOptionType(args.contractType);
  const queryStr = typeof args.query === "string" ? args.query.toLowerCase() : "";
  const inferredCall =
    optionType === "call" ||
    /\b(covered\s*call|cc\s+(idea|setup)|wheel|call\s+ideas?)\b/.test(queryStr);
  if (!inferredCall) {
    return null;
  }
  const symbol =
    typeof args.underlying === "string"
      ? args.underlying.trim().toUpperCase()
      : typeof args.symbol === "string"
        ? args.symbol.trim().toUpperCase()
        : "";
  return {
    error: "empty_book_for_covered_call",
    symbol: symbol || null,
    portfolioId: preload.promptJson.portfolio.id,
    portfolioName: preload.promptJson.portfolio.name,
    hint: "User has no equity positions in the active portfolio. Do not run options_scan for covered-call/wheel ideas tied to their book; ask them to add or import holdings (or pivot to cash-secured-put ideas if they want to enter the position)."
  };
}

export function createXfinanceToolExecutor(ctx: XfinanceToolExecutorContext): ToolExecutor {
  const cacheScopeKey = ctx.workspacePortfolioId?.trim() || "default_portfolio";
  const lazyEnabled =
    ctx.workspaceLazyLoad != null && ctx.workspacePreload === undefined;

  let resolvedPreload: WorkspaceSnapshotPreload | null =
    ctx.workspacePreload !== undefined ? (ctx.workspacePreload ?? null) : null;
  let preloadValid = Boolean(resolvedPreload);
  let lazyFetchStarted = false;

  /** Per-request memo of `op:argsHash → serialized result`; survives only this executor instance. */
  const perRequestResults = new Map<string, string>();

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
    /** Mutation just landed — drop per-request memo so subsequent reads (e.g. portfolio_summary) refetch. */
    perRequestResults.clear();
  };

  const operations = buildOperations(invalidateWorkspacePreload, cacheScopeKey);

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

    /** Per-request dedup: same op + args within one tool-loop ask returns memoized JSON immediately. */
    const perRequestKey = buildPerRequestFingerprint(operation, args);
    const memoed = perRequestResults.get(perRequestKey);
    if (memoed) {
      return { result: memoed };
    }

    if (PRELOAD_SHORT_CIRCUIT_OPS.has(operation)) {
      await ensureLazyPreload();
    }

    if (operation === "options_scan") {
      const guard = buildEmptyBookCoveredCallGuard({
        args,
        preload: resolvedPreload && preloadValid ? resolvedPreload : null
      });
      if (guard) {
        const guardSerialized = JSON.stringify(guard);
        perRequestResults.set(perRequestKey, guardSerialized);
        return { result: guardSerialized };
      }
    }

    if (resolvedPreload && preloadValid) {
      const fromPreload = tryPreloadResult(operation, resolvedPreload, preloadValid);
      if (fromPreload !== null) {
        perRequestResults.set(perRequestKey, fromPreload);
        return { result: fromPreload };
      }
    }

    const toolCacheScopeKey =
      operation === "watchlist_snapshot" ? "user_watchlist_global" : cacheScopeKey;

    if (CACHEABLE_OPERATIONS.has(operation)) {
      const cached = getCachedToolResult(ctx.userId, operation, toolCacheScopeKey);
      if (cached) {
        perRequestResults.set(perRequestKey, cached);
        return { result: cached };
      }
    }

    const data = await handler(args, ctx);
    const serialized = JSON.stringify(data);
    const output = NO_TRUNCATE_JSON_OPERATIONS.has(operation)
      ? serialized
      : truncateOutput(serialized);

    if (CACHEABLE_OPERATIONS.has(operation)) {
      setCachedToolResult(ctx.userId, operation, output, undefined, toolCacheScopeKey);
    }

    perRequestResults.set(perRequestKey, output);

    return { result: output };
  };
}

export { ATXFINANCE_TOOL_DEFINITION, YAHOO_FINANCE_TOOL_DEFINITION };
