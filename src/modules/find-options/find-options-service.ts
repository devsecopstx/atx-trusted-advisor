import { loadAppUserDefaultBook, type AppUserDefaultBook } from "@/lib/app-user-default-book";
import type { SessionUser } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import {
    ensurePortfolioWatchlistForUser,
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
import { lookupSymbols } from "@/modules/watchlist/yahoo-symbol-lookup";
import { getYahooFinance2 } from "@/modules/yahoo/yahoo-finance-service";

function resolveWorkspaceAccount(
  accounts: Account[],
  book: AppUserDefaultBook | null
): Account | undefined {
  if (book?.accountId) {
    const match = accounts.find((a) => a._id?.toHexString() === book.accountId);
    if (match) {
      return match;
    }
  }
  return accounts.find((a) => a.isDefault) ?? accounts[0];
}

import { scanUnderlyingForHotOptions } from "./options-hot-scan";
import { computeRsiFromCloses } from "./rsi";

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
      extAccountId: a.extAccountId?.trim() || "—",
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

export async function getFindOptionsContext(session: SessionUser): Promise<FindOptionsContextPayload> {
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
        optionsApproved: false
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
  const workspaceAccount = resolveWorkspaceAccount(accounts, book);
  const { scoringFactors } = scoringFactorsPayloadForAdminApi(portfolio.scoringFactors);
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
      optionsApproved: optionsApprovedDefault
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

export async function getTopStockHoldingsByValue(
  session: SessionUser,
  limit: number
): Promise<{ holdings: TopHoldingRow[] }> {
  const portfolio = await resolveDefaultPortfolio(session);
  if (!portfolio?._id) {
    return { holdings: [] };
  }

  const portfolioId = portfolio._id.toHexString();
  const accounts = await listPortfolioAccounts({
    userId: session.userId,
    portfolioId,
    tenantId: session.tenantId
  });
  const book = await loadAppUserDefaultBook(session);
  const workspaceAccount = resolveWorkspaceAccount(accounts, book);
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

  const symbols = Array.from(bySymbol.keys());
  if (symbols.length === 0) {
    return { holdings: [] };
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
  return { holdings: rows.slice(0, Math.max(1, Math.min(50, limit))) };
}

export type HotWatchlistRow = {
  symbol: string;
  impliedVolatilityPercent: number;
  openInterest: number;
  strike: number;
  contractType: "call" | "put";
};

const DEFAULT_HOT_IV_MIN = 70;
const DEFAULT_HOT_OI_MIN = 100;
const MAX_WATCHLIST_SCAN = 18;

export async function getHotWatchlistSymbols(
  session: SessionUser,
  limit: number
): Promise<{ rows: HotWatchlistRow[]; scanned: number }> {
  const portfolio = await resolveDefaultPortfolio(session);
  if (!portfolio?._id) {
    return { rows: [], scanned: 0 };
  }

  const watchlist = await ensurePortfolioWatchlistForUser({
    userId: session.userId,
    portfolioId: portfolio._id.toHexString(),
    tenantId: session.tenantId
  });
  const raw = watchlist?.symbols ?? [];
  const symbols = raw.map((s) => s.symbol.trim().toUpperCase()).filter(Boolean);
  const unique = Array.from(new Set(symbols)).slice(0, MAX_WATCHLIST_SCAN);

  const candidates: HotWatchlistRow[] = [];
  let scanned = 0;
  for (const sym of unique) {
    scanned += 1;
    const r = await scanUnderlyingForHotOptions({
      symbol: sym,
      ivMinPct: DEFAULT_HOT_IV_MIN,
      minOi: DEFAULT_HOT_OI_MIN
    });
    if (r.meetsHotCriteria && r.best) {
      candidates.push({
        symbol: r.symbol,
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

export type SymbolSnapshotPayload = {
  symbol: string;
  lastPrice: number | null;
  rsi14: number | null;
  currency: string | null;
};

export async function getSymbolSnapshot(_session: SessionUser, symbol: string): Promise<SymbolSnapshotPayload | null> {
  const sym = symbol.trim().toUpperCase();
  if (!sym) {
    return null;
  }

  const yf = getYahooFinance2();
  let lastPrice: number | null = null;
  let currency: string | null = null;
  try {
    const quote = (await yf.quote(sym)) as Record<string, unknown>;
    const p = quote["regularMarketPrice"] ?? quote["postMarketPrice"] ?? quote["preMarketPrice"];
    if (typeof p === "number" && Number.isFinite(p)) {
      lastPrice = p;
    }
    const c = quote["currency"];
    currency = typeof c === "string" ? c : null;
  } catch {
    const map = await lookupSymbols([sym]);
    const q = map.get(sym);
    lastPrice = typeof q?.price === "number" && Number.isFinite(q.price) ? q.price : null;
    currency = q?.currency ?? null;
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
    rsi14,
    currency
  };
}
