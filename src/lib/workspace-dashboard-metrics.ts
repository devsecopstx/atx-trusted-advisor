import { computePortfolioOverviewMetrics, formatUsd2 } from "@/lib/portfolio-overview-metrics";
import {
    DEFAULT_ACCOUNT_CASH_BALANCE,
    listPortfolioAccounts,
    listPortfolioPositionsByAccount,
    listPortfoliosForSessionUser
} from "@/modules/core-admin/repository";
import { normalizePositionType, parseAccountOutlook, type AccountOutlook } from "@/modules/core-admin/types";
import { lookupSymbols } from "@/modules/watchlist/yahoo-symbol-lookup";

export type WorkspaceDashboardAccountSlice = {
  portfolioId: string;
  portfolioName: string;
  accountId: string;
  accountName: string;
  valueUsd: number;
  /** Per-account desk risk; null when unset. */
  riskProfile: "conservative" | "balanced" | "growth" | null;
  /** Per-account market outlook; null when unset. */
  outlook: AccountOutlook | null;
};

/**
 * Per-account book values across all of the user’s portfolios (for workspace dashboard charts).
 * APIs and admin flows should key off `portfolioId` / `accountId`, not display names.
 */
export async function listWorkspaceDashboardAccountSlices(input: {
  userId: string;
  tenantId?: string;
}): Promise<WorkspaceDashboardAccountSlice[]> {
  const portfolios = await listPortfoliosForSessionUser({
    userId: input.userId,
    tenantId: input.tenantId
  });
  const slices: WorkspaceDashboardAccountSlice[] = [];

  for (const p of portfolios) {
    const pid = p._id?.toHexString();
    if (!pid) {
      continue;
    }
    const portfolioName = (p.name && p.name.trim()) || "Portfolio";
    const accounts = await listPortfolioAccounts({
      userId: input.userId,
      portfolioId: pid,
      tenantId: input.tenantId
    });
    const accountIds = accounts.flatMap((a) => (a._id ? [a._id] : []));
    const positions = await listPortfolioPositionsByAccount({
      userId: input.userId,
      tenantId: input.tenantId,
      portfolioId: pid,
      accountIds
    });
    const metrics = computePortfolioOverviewMetrics(positions, accounts, DEFAULT_ACCOUNT_CASH_BALANCE);
    const deskByHex = new Map<
      string,
      { riskProfile: WorkspaceDashboardAccountSlice["riskProfile"]; outlook: AccountOutlook | null }
    >();
    for (const a of accounts) {
      if (!a._id) {
        continue;
      }
      deskByHex.set(a._id.toHexString(), {
        riskProfile: a.riskProfile ?? null,
        outlook: parseAccountOutlook(a.outlook)
      });
    }
    for (const row of metrics.byAccount) {
      const valueUsd = row.valueExcludingOptions + row.optionBookValue;
      const desk = deskByHex.get(row.accountIdHex);
      slices.push({
        portfolioId: pid,
        portfolioName,
        accountId: row.accountIdHex,
        accountName: row.name,
        valueUsd,
        riskProfile: desk?.riskProfile ?? null,
        outlook: desk?.outlook ?? null
      });
    }
  }

  return slices;
}

export type WorkspaceHeroTopHolding = {
  symbol: string;
  bookUsd: number;
};

/** @deprecated Prefer {@link listWorkspaceTopBookMoversForDashboard} for /portfolios Top book card. */
export async function listWorkspaceTopStockHoldingsForHero(input: {
  userId: string;
  tenantId?: string;
  limit?: number;
}): Promise<WorkspaceHeroTopHolding[]> {
  const limit = input.limit ?? 5;
  const portfolios = await listPortfoliosForSessionUser({
    userId: input.userId,
    tenantId: input.tenantId
  });
  const bookBySymbol = new Map<string, number>();

  for (const p of portfolios) {
    const pid = p._id?.toHexString();
    if (!pid) {
      continue;
    }
    const accounts = await listPortfolioAccounts({
      userId: input.userId,
      portfolioId: pid,
      tenantId: input.tenantId
    });
    const accountIds = accounts.flatMap((a) => (a._id ? [a._id] : []));
    const positions = await listPortfolioPositionsByAccount({
      userId: input.userId,
      tenantId: input.tenantId,
      portfolioId: pid,
      accountIds
    });
    for (const pos of positions) {
      if (normalizePositionType(pos.type) !== "stock") {
        continue;
      }
      const sym = pos.symbol.trim().toUpperCase();
      if (!sym) {
        continue;
      }
      const book = pos.qty * pos.avgCost;
      if (!Number.isFinite(book) || book <= 0) {
        continue;
      }
      bookBySymbol.set(sym, (bookBySymbol.get(sym) ?? 0) + book);
    }
  }

  return [...bookBySymbol.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([symbol, bookUsd]) => ({ symbol, bookUsd }));
}

export type WorkspaceTopBookMoverRow = {
  symbol: string;
  companyName: string;
  lastPriceDisplay: string;
  dayChangeUsdDisplay: string;
  dayChangePercentDisplay: string;
  tone: "gain" | "loss" | "flat";
};

type StockAgg = { qty: number; bookUsd: number };

async function aggregateWorkspaceStocksBySymbol(input: {
  userId: string;
  tenantId?: string;
}): Promise<Map<string, StockAgg>> {
  const portfolios = await listPortfoliosForSessionUser({
    userId: input.userId,
    tenantId: input.tenantId
  });
  const agg = new Map<string, StockAgg>();

  for (const p of portfolios) {
    const pid = p._id?.toHexString();
    if (!pid) {
      continue;
    }
    const accounts = await listPortfolioAccounts({
      userId: input.userId,
      portfolioId: pid,
      tenantId: input.tenantId
    });
    const accountIds = accounts.flatMap((a) => (a._id ? [a._id] : []));
    const positions = await listPortfolioPositionsByAccount({
      userId: input.userId,
      tenantId: input.tenantId,
      portfolioId: pid,
      accountIds
    });
    for (const pos of positions) {
      if (normalizePositionType(pos.type) !== "stock") {
        continue;
      }
      const sym = pos.symbol.trim().toUpperCase();
      if (!sym) {
        continue;
      }
      const book = pos.qty * pos.avgCost;
      if (!Number.isFinite(book) || book <= 0 || !Number.isFinite(pos.qty) || pos.qty === 0) {
        continue;
      }
      const prev = agg.get(sym) ?? { qty: 0, bookUsd: 0 };
      agg.set(sym, {
        qty: prev.qty + pos.qty,
        bookUsd: prev.bookUsd + book
      });
    }
  }

  return agg;
}

function formatSignedUsdNoSymbol(amount: number): string {
  const abs = Math.abs(amount);
  const core = formatUsd2(abs);
  if (amount > 0) {
    return `+${core}`;
  }
  if (amount < 0) {
    return `-${core}`;
  }
  return formatUsd2(0);
}

function formatSignedPercent(pct: number): string {
  if (!Number.isFinite(pct)) {
    return "—";
  }
  const sign = pct > 0 ? "+" : pct < 0 ? "" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export type WorkspaceBooksDayMarkSummary = {
  /** Σ (aggregated qty × Yahoo `change`) over the quoted stock universe (largest books first, capped). */
  dayChangeUsd: number;
  /** `dayChangeUsd` as % of prior close notional Σ (qty × (price − change)) when that denominator &gt; 0. */
  dayChangePercent: number | null;
  hasQuoteCoverage: boolean;
};

export type WorkspacePortfoliosStockPulse = {
  movers: WorkspaceTopBookMoverRow[];
  booksDayMark: WorkspaceBooksDayMarkSummary;
};

/**
 * Single aggregation + Yahoo batch for /portfolios movers card and books day mark (avoid duplicate work).
 */
export async function loadWorkspacePortfoliosStockPulse(input: {
  userId: string;
  tenantId?: string;
  maxQuoteSymbols?: number;
  winnersCount?: number;
  losersCount?: number;
}): Promise<WorkspacePortfoliosStockPulse> {
  const maxQuoteSymbols = input.maxQuoteSymbols ?? 72;
  const winnersCount = input.winnersCount ?? 2;
  const losersCount = input.losersCount ?? 2;

  const agg = await aggregateWorkspaceStocksBySymbol(input);
  if (agg.size === 0) {
    return {
      movers: [],
      booksDayMark: { dayChangeUsd: 0, dayChangePercent: null, hasQuoteCoverage: false }
    };
  }

  const capped = [...agg.entries()]
    .sort((a, b) => b[1].bookUsd - a[1].bookUsd)
    .slice(0, maxQuoteSymbols)
    .map(([symbol, v]) => ({ symbol, qty: v.qty, bookUsd: v.bookUsd }));

  const quoteMap = await lookupSymbols(
    capped.map((r) => r.symbol),
    { allowNetwork: true }
  );

  let totalDayUsd = 0;
  let totalPriorNotional = 0;
  let countedRows = 0;

  type Scored = {
    symbol: string;
    qty: number;
    changePercent: number;
    dayUsd: number;
    companyName: string;
    lastPriceDisplay: string;
    dayChangeUsdDisplay: string;
    dayChangePercentDisplay: string;
    tone: WorkspaceTopBookMoverRow["tone"];
  };

  const scored: Scored[] = [];

  for (const row of capped) {
    const q = quoteMap.get(row.symbol);
    const price = q?.price;
    const change = q?.change;
    const pct = q?.changePercent;
    const companyName = (q?.companyName?.trim() || row.symbol).slice(0, 80);

    if (
      Number.isFinite(row.qty) &&
      typeof price === "number" &&
      Number.isFinite(price) &&
      typeof change === "number" &&
      Number.isFinite(change)
    ) {
      const prevClose = price - change;
      if (prevClose > 0) {
        totalDayUsd += row.qty * change;
        totalPriorNotional += row.qty * prevClose;
        countedRows += 1;
      }
    }

    const lastPriceDisplay =
      typeof price === "number" && Number.isFinite(price) && price > 0 ? formatUsd2(price) : "—";

    let dayUsd = Number.NaN;
    if (typeof change === "number" && Number.isFinite(change) && Number.isFinite(row.qty)) {
      dayUsd = row.qty * change;
    }
    const dayChangeUsdDisplay =
      Number.isFinite(dayUsd) && dayUsd !== 0 ? formatSignedUsdNoSymbol(dayUsd) : Number.isFinite(dayUsd) ? formatUsd2(0) : "—";

    const dayChangePercentDisplay = typeof pct === "number" && Number.isFinite(pct) ? formatSignedPercent(pct) : "—";

    let tone: WorkspaceTopBookMoverRow["tone"] = "flat";
    if (Number.isFinite(dayUsd) && dayUsd > 0) {
      tone = "gain";
    } else if (Number.isFinite(dayUsd) && dayUsd < 0) {
      tone = "loss";
    } else if (typeof pct === "number" && Number.isFinite(pct)) {
      if (pct > 0) {
        tone = "gain";
      } else if (pct < 0) {
        tone = "loss";
      }
    }

    scored.push({
      symbol: row.symbol,
      qty: row.qty,
      changePercent: typeof pct === "number" && Number.isFinite(pct) ? pct : 0,
      dayUsd: Number.isFinite(dayUsd) ? dayUsd : 0,
      companyName,
      lastPriceDisplay,
      dayChangeUsdDisplay,
      dayChangePercentDisplay,
      tone
    });
  }

  const hasQuoteCoverage = countedRows > 0 && totalPriorNotional > 0;
  const dayChangePercent =
    hasQuoteCoverage && Number.isFinite(totalDayUsd) ? (totalDayUsd / totalPriorNotional) * 100 : null;

  const booksDayMark: WorkspaceBooksDayMarkSummary = {
    dayChangeUsd: Number.isFinite(totalDayUsd) ? totalDayUsd : 0,
    dayChangePercent,
    hasQuoteCoverage
  };

  const winners = scored
    .filter((r) => r.changePercent > 0)
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, winnersCount);

  const losers = scored
    .filter((r) => r.changePercent < 0)
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, losersCount);

  const combined = [...winners, ...losers];
  const seen = new Set<string>();
  const movers: WorkspaceTopBookMoverRow[] = [];
  for (const r of combined) {
    if (seen.has(r.symbol)) {
      continue;
    }
    seen.add(r.symbol);
    movers.push({
      symbol: r.symbol,
      companyName: r.companyName,
      lastPriceDisplay: r.lastPriceDisplay,
      dayChangeUsdDisplay: r.dayChangeUsdDisplay,
      dayChangePercentDisplay: r.dayChangePercentDisplay,
      tone: r.tone
    });
  }

  return { movers, booksDayMark };
}

/**
 * Top / bottom **stock** movers across the user’s books (workspace-wide), using Yahoo day change × aggregated qty.
 * Quotes are batched; symbols beyond `maxQuoteSymbols` (by book size) are skipped to protect Yahoo limits.
 */
export async function listWorkspaceTopBookMoversForDashboard(input: {
  userId: string;
  tenantId?: string;
  /** Max distinct tickers to quote (highest book first). */
  maxQuoteSymbols?: number;
  winnersCount?: number;
  losersCount?: number;
}): Promise<WorkspaceTopBookMoverRow[]> {
  return (await loadWorkspacePortfoliosStockPulse(input)).movers;
}
