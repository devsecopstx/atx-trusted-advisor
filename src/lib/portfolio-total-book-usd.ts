import { computePortfolioOverviewMetrics } from "@/lib/portfolio-overview-metrics";
import {
    DEFAULT_ACCOUNT_CASH_BALANCE,
    listPortfolioAccounts,
    listPortfolioPositionsByAccount
} from "@/modules/core-admin/repository";

/**
 * Book-style total USD for a portfolio (cash + positions), consistent with `/portfolio` overview.
 */
export async function getPortfolioTotalBookUsdForSessionUser(input: {
  userId: string;
  tenantId?: string;
  portfolioId: string;
}): Promise<number> {
  const accounts = await listPortfolioAccounts({
    userId: input.userId,
    portfolioId: input.portfolioId,
    tenantId: input.tenantId
  });
  const accountIds = accounts.flatMap((a) => (a._id ? [a._id] : []));
  const positions = await listPortfolioPositionsByAccount({
    userId: input.userId,
    tenantId: input.tenantId,
    portfolioId: input.portfolioId,
    accountIds
  });
  const metrics = computePortfolioOverviewMetrics(positions, accounts, DEFAULT_ACCOUNT_CASH_BALANCE);
  return metrics.totalBookInclOptionsUsd;
}
