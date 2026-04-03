import { computePortfolioOverviewMetrics } from "@/lib/portfolio-overview-metrics";
import {
    DEFAULT_ACCOUNT_CASH_BALANCE,
    listPortfolioAccounts,
    listPortfolioPositionsByAccount,
    listPortfoliosForSessionUser
} from "@/modules/core-admin/repository";
import { normalizePositionType } from "@/modules/core-admin/types";

export type WorkspaceDashboardAccountSlice = {
  portfolioId: string;
  portfolioName: string;
  accountId: string;
  accountName: string;
  valueUsd: number;
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
    for (const row of metrics.byAccount) {
      const valueUsd = row.valueExcludingOptions + row.optionBookValue;
      slices.push({
        portfolioId: pid,
        portfolioName,
        accountId: row.accountIdHex,
        accountName: row.name,
        valueUsd
      });
    }
  }

  return slices;
}

export type WorkspaceHeroTopHolding = {
  symbol: string;
  bookUsd: number;
};

/** Aggregated stock cost basis by ticker across every portfolio (for compact /portfolios hero). */
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
