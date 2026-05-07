import { maskAccountXrefForDisplay } from "@/lib/account-xref-display";
import { loadAppUserDefaultBook, type AppUserDefaultBook } from "@/lib/app-user-default-book";
import type { SessionUser } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { normalizeMongoObjectIdParam } from "@/lib/mongo-object-id-hex";
import { getTenantByHexIdCached } from "@/lib/server-request-cache";
import {
    ensureUserWatchlistForSessionUser,
    getDefaultPortfolio,
    listPortfolioAccounts,
    listPortfolioPositionsByAccount,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import { scoringFactorsPayloadForAdminApi } from "@/modules/core-admin/scoring-factors";
import {
    normalizePositionType,
    parseAccountOutlook,
    type Account,
    type AccountOutlook,
    type Portfolio
} from "@/modules/core-admin/types";
import { underlyingForYahooOptionsChain } from "@/modules/watchlist/option-expiration";
import { lookupSymbols } from "@/modules/watchlist/yahoo-symbol-lookup";
import {
    loadWorkspaceSnapshotPreload,
    normalizeWorkspaceContentRev,
    type WorkspaceSnapshotPreload
} from "@/modules/xchat/workspace-snapshot-for-prompt";
import { getYahooFinance2 } from "@/modules/yahoo/yahoo-finance-service";
import { yahooQuoteWithValidationFallback } from "@/modules/yahoo/yahoo-quote-validation-fallback";

import { scanUnderlyingForHotOptions } from "./options-hot-scan";
import { computeRsiFromCloses } from "./rsi";

function resolveWorkspaceAccount(
  accounts: Account[],
  book: AppUserDefaultBook | null,
  accountIdOverride?: string | null
): Account | undefined {
  const override = accountIdOverride?.trim();
  if (override) {
    const overrideNorm = normalizeMongoObjectIdParam(override);
    const overrideMatch = accounts.find((a) => a._id?.toHexString() === overrideNorm);
    if (overrideMatch) {
      return overrideMatch;
    }
  }
  if (book?.accountId) {
    const match = accounts.find((a) => a._id?.toHexString() === book.accountId);
    if (match) {
      return match;
    }
  }
  return accounts.find((a) => a.isDefault) ?? accounts[0];
}

export type FindOptionsAccountRow = {
  id: string;
  name: string;
  extAccountId: string;
  isDefault: boolean;
  optionsApproved: boolean;
  riskProfile: "conservative" | "balanced" | "growth" | null;
  outlook: AccountOutlook | null;
};

export type FindOptionsContextPayload = {
  portfolio: {
    id: string;
    name: string;
  } | null;
  accounts: FindOptionsAccountRow[];
  account: {
    id: string | null;
    name: string;
    riskProfile: "conservative" | "balanced" | "growth" | null;
    outlook: AccountOutlook | null;
    optionsApproved: boolean;
    cashBalance: number | null;
  };
  bookOutlook: AccountOutlook | null;
  bookRiskProfile: "conservative" | "balanced" | "growth" | null;
  scoringFactors: ReturnType<typeof scoringFactorsPayloadForAdminApi>["scoringFactors"];
};

export function resolveAccountOptionsApproved(account: Account, assumeAllApproved: boolean): boolean {
  if (typeof account.optionsTradingEnabled === "boolean") {
    return account.optionsTradingEnabled;
  }
  return assumeAllApproved;
}

export function buildFindOptionsAccountRows(
  accounts: Account[],
  assumeAllApproved: boolean
): FindOptionsAccountRow[] {
  return accounts
    .filter((a): a is Account & { _id: NonNullable<Account["_id"]> } => Boolean(a._id))
    .map((a) => ({
      id: a._id.toHexString(),
      name: a.name?.trim() || "Account",
      extAccountId: maskAccountXrefForDisplay(a.extAccountId?.trim() || ""),
      isDefault: Boolean(a.isDefault),
      optionsApproved: resolveAccountOptionsApproved(a, assumeAllApproved),
      riskProfile: a.riskProfile ?? null,
      outlook: a.outlook ?? null
    }));
}

async function resolveDefaultPortfolio(session: SessionUser): Promise<Portfolio | null> {
  let portfolio = await getDefaultPortfolio(session.userId, { tenantId: session.tenantId });
  if (!portfolio?._id) {
    const provisioned = await provisionDefaultPortfolioForUser({
      userId: session.userId,
      tenantId: session.tenantId,
      watchlistSymbols: ["TSLA"]
    });
    portfolio = provisioned.portfolio;
  }
  return portfolio;
}

export async function getFindOptionsContext(
  session: SessionUser,
  input?: { accountId?: string | null }
): Promise<FindOptionsContextPayload> {
  const portfolio = await resolveDefaultPortfolio(session);
  const book = await loadAppUserDefaultBook(session);
  const assumeAllApproved = getEnv().XOPTIONS_ASSUME_OPTIONS_APPROVED;

  if (!portfolio?._id) {
    return {
      portfolio: null,
      accounts: [],
      account: {
        id: null,
        name: "Account",
        riskProfile: null,
        outlook: null,
        optionsApproved: false,
        cashBalance: null
      },
      bookOutlook: null,
      bookRiskProfile: null,
      scoringFactors: scoringFactorsPayloadForAdminApi(undefined).scoringFactors
    };
  }

  const accounts = await listPortfolioAccounts({
    userId: session.userId,
    portfolioId: portfolio._id.toHexString(),
    tenantId: session.tenantId
  });
  const workspaceAccount = resolveWorkspaceAccount(accounts, book, input?.accountId ?? null);
  const scoringTenantId = portfolio.tenantId?.toHexString() ?? session.tenantId;
  const tenantRow = await getTenantByHexIdCached(scoringTenantId);
  const { scoringFactors: rawSf } = scoringFactorsPayloadForAdminApi(
    portfolio.scoringFactors,
    tenantRow?.defaultPortfolioScoringFactors
  );
  const scoringFactors =
    rawSf.length > 0
      ? rawSf
      : scoringFactorsPayloadForAdminApi(undefined).scoringFactors;
  const accountRows = buildFindOptionsAccountRows(accounts, assumeAllApproved);
  const workspaceRow = workspaceAccount?._id
    ? accountRows.find((r) => r.id === workspaceAccount._id!.toHexString())
    : undefined;
  const optionsApprovedDefault = workspaceRow?.optionsApproved ?? false;

  return {
    portfolio: {
      id: portfolio._id.toHexString(),
      name: portfolio.name?.trim() || "Portfolio"
    },
    accounts: accountRows,
    account: {
      id: workspaceAccount?._id ? workspaceAccount._id.toHexString() : book?.accountId ?? null,
      name: workspaceAccount?.name?.trim() || book?.accountName || "Account",
      riskProfile: workspaceAccount?.riskProfile ?? null,
      outlook: workspaceAccount?.outlook ?? null,
      optionsApproved: optionsApprovedDefault,
      cashBalance:
        typeof workspaceAccount?.cashBalance === "number" && Number.isFinite(workspaceAccount.cashBalance)
          ? workspaceAccount.cashBalance
          : null
    },
    bookOutlook: parseAccountOutlook(workspaceAccount?.outlook ?? null),
    bookRiskProfile: workspaceAccount?.riskProfile ?? null,
    scoringFactors
  };
}

export type TopHoldingRow = {
  symbol: string;
  marketValue: number;
  shares: number;
  lastPrice: number | null;
};

function isStockLikePreloadRow(row: WorkspaceSnapshotPreload["positionsFull"][number]): boolean {
  const t = row.positionType;
  if (t === "option" || t === "cash") {
    return false;
  }
  return true;
}

async function finalizeTopHoldingsFromAgg(
  bySymbol: Map<string, { shares: number; costBasis: number }>,
  limit: number
): Promise<TopHoldingRow[]> {
  const symbols = Array.from(bySymbol.keys());
  if (symbols.length === 0) {
    return [];
  }

  const quoteMap = await lookupSymbols(symbols);
  const rows: TopHoldingRow[] = [];
  for (const sym of symbols) {
    const agg = bySymbol.get(sym)!;
    const q = quoteMap.get(sym);
    const lastPrice = typeof q?.price === "number" && Number.isFinite(q.price) ? q.price : null;
    const mv =
      lastPrice != null && lastPrice > 0
        ? agg.shares * lastPrice
        : agg.shares * (agg.costBasis / Math.max(agg.shares, 1e-9));
    rows.push({
      symbol: sym,
      marketValue: Math.round(mv * 100) / 100,
      shares: agg.shares,
      lastPrice
    });
  }

  rows.sort((a, b) => b.marketValue - a.marketValue);
  return rows.slice(0, Math.max(1, Math.min(50, limit)));
}

/**
 * When xChat workspace snapshot (Redis / in-process) matches this portfolio rev, reuse positions
 * and skip `listPortfolioPositionsByAccount` (same payload as xChat `atx_function` preload).
 */
async function topHoldingsFromWorkspacePreloadIfFresh(
  portfolio: Portfolio & { _id: NonNullable<Portfolio["_id"]> },
  preload: WorkspaceSnapshotPreload | null,
  book: AppUserDefaultBook | null,
  accountIdOverride: string | null | undefined,
  limit: number
): Promise<TopHoldingRow[] | null> {
  if (!preload) {
    return null;
  }
  const portfolioId = portfolio._id.toHexString();
  if (preload.promptJson.portfolio.id !== portfolioId) {
    return null;
  }
  if (preload.promptJson.workspaceContentRev !== normalizeWorkspaceContentRev(portfolio)) {
    return null;
  }

  const promptAccounts = preload.promptJson.accounts;
  const overrideId = accountIdOverride?.trim();
  const bookId = book?.accountId?.trim();
  const preferredId = overrideId && overrideId.length > 0 ? overrideId : bookId;
  const workspaceAccountId = preferredId
    ? promptAccounts.find((a) => a.accountId === preferredId)?.accountId
    : promptAccounts.find((a) => a.isDefault)?.accountId ?? promptAccounts[0]?.accountId;

  const allowed = new Set(
    workspaceAccountId
      ? [workspaceAccountId]
      : promptAccounts.map((a) => a.accountId).filter((id) => id.length > 0)
  );
  if (allowed.size === 0) {
    return null;
  }

  const bySymbol = new Map<string, { shares: number; costBasis: number }>();
  for (const row of preload.positionsFull) {
    if (!allowed.has(row.accountId)) {
      continue;
    }
    if (!isStockLikePreloadRow(row)) {
      continue;
    }
    const sym = row.symbol.trim().toUpperCase();
    if (!sym || sym === "CASH" || sym === "USD") {
      continue;
    }
    const prev = bySymbol.get(sym) ?? { shares: 0, costBasis: 0 };
    prev.shares += row.qty;
    prev.costBasis += row.qty * row.avgCost;
    bySymbol.set(sym, prev);
  }

  return finalizeTopHoldingsFromAgg(bySymbol, limit);
}

export async function getTopStockHoldingsByValue(
  session: SessionUser,
  limit: number,
  input?: { accountId?: string | null },
  opts?: { coordinatingRequest?: Request }
): Promise<{ holdings: TopHoldingRow[] }> {
  const portfolio = await resolveDefaultPortfolio(session);
  if (!portfolio?._id) {
    return { holdings: [] };
  }

  const portfolioId = portfolio._id.toHexString();
  const book = await loadAppUserDefaultBook(session);
  const preload = await loadWorkspaceSnapshotPreload(
    {
      userId: session.userId,
      tenantId: session.tenantId
    },
    { snapshotQuoteNetwork: "live", coordinatingRequest: opts?.coordinatingRequest }
  );
  const fast = await topHoldingsFromWorkspacePreloadIfFresh(
    portfolio as Portfolio & { _id: NonNullable<Portfolio["_id"]> },
    preload,
    book,
    input?.accountId ?? null,
    limit
  );
  if (fast !== null) {
    return { holdings: fast };
  }

  const accounts = await listPortfolioAccounts({
    userId: session.userId,
    portfolioId,
    tenantId: session.tenantId
  });
  const workspaceAccount = resolveWorkspaceAccount(accounts, book, input?.accountId ?? null);
  const accountIds =
    workspaceAccount?._id != null
      ? [workspaceAccount._id]
      : accounts.flatMap((a) => (a._id ? [a._id] : []));
  if (accountIds.length === 0) {
    return { holdings: [] };
  }

  const positions = await listPortfolioPositionsByAccount({
    userId: session.userId,
    portfolioId,
    accountIds,
    tenantId: session.tenantId
  });

  const bySymbol = new Map<string, { shares: number; costBasis: number }>();
  for (const p of positions) {
    if (normalizePositionType(p.type) !== "stock") {
      continue;
    }
    const sym = p.symbol.trim().toUpperCase();
    if (!sym || sym === "CASH" || sym === "USD") {
      continue;
    }
    const prev = bySymbol.get(sym) ?? { shares: 0, costBasis: 0 };
    prev.shares += p.qty;
    prev.costBasis += p.qty * p.avgCost;
    bySymbol.set(sym, prev);
  }

  const holdings = await finalizeTopHoldingsFromAgg(bySymbol, limit);
  return { holdings };
}

export type HotWatchlistRow = {
  symbol: string;
  /** Underlying spot when Yahoo quote resolves. */
  spot: number | null;
  impliedVolatilityPercent: number;
  openInterest: number;
  strike: number;
  contractType: "call" | "put";
};

const DEFAULT_HOT_IV_MIN = 50;
const DEFAULT_HOT_OI_MIN = 50;
const MAX_WATCHLIST_SCAN = 18;

export async function getHotWatchlistSymbols(
  session: SessionUser,
  limit: number,
  opts?: { portfolioId?: string | null }
): Promise<{ rows: HotWatchlistRow[]; scanned: number }> {
  void opts;
  /** Tenant-scoped user watchlist (one doc per user) — same symbols on /portfolios, /portfolio, /watchlist. */
  const watchlist = await ensureUserWatchlistForSessionUser({
    userId: session.userId,
    tenantId: session.tenantId
  });
  const raw = watchlist?.symbols ?? [];
  const symbols = raw.map((s) => s.symbol.trim().toUpperCase()).filter(Boolean);
  const unique = Array.from(new Set(symbols)).slice(0, MAX_WATCHLIST_SCAN);

  const candidates: HotWatchlistRow[] = [];
  let scanned = 0;
  /** One Yahoo chain fetch per underlying (many watchlist legs can share the same name). */
  const chainScanByUnderlying = new Map<string, Awaited<ReturnType<typeof scanUnderlyingForHotOptions>>>();
  const addedUnderlyings = new Set<string>();

  for (const sym of unique) {
    scanned += 1;
    const chainSym = underlyingForYahooOptionsChain(sym);
    let r = chainScanByUnderlying.get(chainSym);
    if (!r) {
      r = await scanUnderlyingForHotOptions({
        symbol: chainSym,
        ivMinPct: DEFAULT_HOT_IV_MIN,
        minOi: DEFAULT_HOT_OI_MIN
      });
      chainScanByUnderlying.set(chainSym, r);
    }
    if (r.meetsHotCriteria && r.best && !addedUnderlyings.has(chainSym)) {
      addedUnderlyings.add(chainSym);
      candidates.push({
        symbol: r.symbol,
        spot: r.underlyingSpot,
        impliedVolatilityPercent: r.best.impliedVolatilityPercent,
        openInterest: r.best.openInterest,
        strike: r.best.strike,
        contractType: r.best.contractType
      });
    }
  }

  candidates.sort(
    (a, b) =>
      b.impliedVolatilityPercent * Math.log1p(b.openInterest) -
      a.impliedVolatilityPercent * Math.log1p(a.openInterest)
  );

  const cap = Math.max(1, Math.min(10, limit));
  return { rows: candidates.slice(0, cap), scanned };
}

/** One round-trip for xOptions workspace: context + top holdings + hot watchlist scan. */
export async function getFindOptionsBootstrap(
  session: SessionUser,
  input: { holdingsLimit: number; hotLimit: number; accountId?: string | null },
  opts?: { coordinatingRequest?: Request }
): Promise<{
  context: FindOptionsContextPayload;
  holdings: TopHoldingRow[];
  hot: { rows: HotWatchlistRow[]; scanned: number };
}> {
  const [context, holdingsResult, hotResult] = await Promise.all([
    getFindOptionsContext(session, { accountId: input.accountId ?? null }),
    getTopStockHoldingsByValue(session, input.holdingsLimit, { accountId: input.accountId ?? null }, opts),
    getHotWatchlistSymbols(session, input.hotLimit)
  ]);
  return {
    context,
    holdings: holdingsResult.holdings,
    hot: { rows: hotResult.rows, scanned: hotResult.scanned }
  };
}

export type SymbolSnapshotPayload = {
  symbol: string;
  lastPrice: number | null;
  /** Session dollar change (regular). */
  change: number | null;
  /** Session percent change (regular), as displayed percent (e.g. -1.25 = -1.25%). */
  changePercent: number | null;
  dayLow: number | null;
  dayHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyDayAverage: number | null;
  rsi14: number | null;
  currency: string | null;
};

function quoteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function getSymbolSnapshot(_session: SessionUser, symbol: string): Promise<SymbolSnapshotPayload | null> {
  const sym = symbol.trim().toUpperCase();
  if (!sym) {
    return null;
  }

  const yf = getYahooFinance2();
  let lastPrice: number | null = null;
  let currency: string | null = null;
  let change: number | null = null;
  let changePercent: number | null = null;
  let dayLow: number | null = null;
  let dayHigh: number | null = null;
  let fiftyTwoWeekLow: number | null = null;
  let fiftyTwoWeekHigh: number | null = null;
  let fiftyDayAverage: number | null = null;
  try {
    const quote = (await yahooQuoteWithValidationFallback(yf, sym, "find-options snapshot")) as Record<string, unknown>;
    const p = quote["regularMarketPrice"] ?? quote["postMarketPrice"] ?? quote["preMarketPrice"];
    if (typeof p === "number" && Number.isFinite(p)) {
      lastPrice = p;
    }
    const c = quote["currency"];
    currency = typeof c === "string" ? c : null;
    change = quoteNumber(quote["regularMarketChange"]);
    changePercent = quoteNumber(quote["regularMarketChangePercent"]);
    dayLow = quoteNumber(quote["regularMarketDayLow"]);
    dayHigh = quoteNumber(quote["regularMarketDayHigh"]);
    fiftyTwoWeekLow = quoteNumber(quote["fiftyTwoWeekLow"]);
    fiftyTwoWeekHigh = quoteNumber(quote["fiftyTwoWeekHigh"]);
    fiftyDayAverage = quoteNumber(quote["fiftyDayAverage"]);
  } catch {
    const map = await lookupSymbols([sym]);
    const q = map.get(sym);
    lastPrice = typeof q?.price === "number" && Number.isFinite(q.price) ? q.price : null;
    currency = q?.currency ?? null;
    change = q?.change != null && Number.isFinite(q.change) ? q.change : null;
    changePercent = q?.changePercent != null && Number.isFinite(q.changePercent) ? q.changePercent : null;
    dayLow = q?.low != null && Number.isFinite(q.low) ? q.low : null;
    dayHigh = q?.high != null && Number.isFinite(q.high) ? q.high : null;
  }

  let rsi14: number | null = null;
  try {
    const period2 = new Date();
    const period1 = new Date(period2.getTime() - 120 * 24 * 60 * 60 * 1000);
    const chart = (await yf.chart(sym, {
      period1,
      period2,
      interval: "1d"
    })) as { quotes?: Array<{ close?: number | null }> };
    const closes = (chart.quotes ?? [])
      .map((q) => q.close)
      .filter((c): c is number => typeof c === "number" && Number.isFinite(c) && c > 0);
    rsi14 = computeRsiFromCloses(closes, 14);
  } catch {
    rsi14 = null;
  }

  return {
    symbol: sym,
    lastPrice,
    change,
    changePercent,
    dayLow,
    dayHigh,
    fiftyTwoWeekLow,
    fiftyTwoWeekHigh,
    fiftyDayAverage,
    rsi14,
    currency
  };
}
