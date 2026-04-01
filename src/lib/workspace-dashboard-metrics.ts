import { computePortfolioOverviewMetrics } from "@/lib/portfolio-overview-metrics";
import {
  DEFAULT_ACCOUNT_CASH_BALANCE,
  listPortfolioAccounts,
  listPortfolioPositionsByAccount,
  listPortfoliosForSessionUser
} from "@/modules/core-admin/repository";

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
