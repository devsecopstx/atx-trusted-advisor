import type { SerializablePosition } from "@/app/portfolio/accounts/serializable-account";
import { buildPortfolioAccountTableRows } from "@/app/portfolio/ui/build-portfolio-account-table-rows";
import { PortfolioManageShell } from "@/app/portfolio/ui/portfolio-manage-shell";
import type { PortfolioHoldingRow } from "@/lib/portfolio-holding-rows";
import type { PortfolioOverviewMetrics } from "@/lib/portfolio-overview-metrics";
import type { PortfolioScoringFactorApi } from "@/modules/core-admin/scoring-factors";
import type { Account } from "@/modules/core-admin/types";

import type { PortfolioDeskPrefetchStrip } from "@/app/portfolio/ui/portfolio-desk-prefetch";

export type { PortfolioDeskPrefetchStrip };

type PortfolioOverviewProps = {
  portfolioDisplayName: string;
  portfolioIdHex: string;
  accounts: Account[];
  metrics: PortfolioOverviewMetrics;
  admin: boolean;
  holdingsRows: PortfolioHoldingRow[];
  positionsByAccount: Record<string, SerializablePosition[]>;
  scoringFactors: PortfolioScoringFactorApi[];
  deskPrefetch?: PortfolioDeskPrefetchStrip | null;
  portfolioStockSymbolsUpper: readonly string[];
};

export function PortfolioOverview({
  portfolioDisplayName,
  portfolioIdHex,
  accounts,
  metrics,
  admin,
  holdingsRows,
  positionsByAccount,
  scoringFactors,
  deskPrefetch = null,
  portfolioStockSymbolsUpper
}: PortfolioOverviewProps) {
  const defaultAccountHex =
    metrics.byAccount.find((r) => r.isDefault)?.accountIdHex ?? metrics.byAccount[0]?.accountIdHex ?? "";

  const accountManageOptions = accounts
    .filter((account): account is Account & { _id: NonNullable<Account["_id"]> } => Boolean(account._id))
    .map((account) => ({
      id: account._id.toHexString(),
      name: account.name,
      isDefault: Boolean(account.isDefault)
    }));

  const tableRows = buildPortfolioAccountTableRows(accounts, metrics);

  return (
    <PortfolioManageShell
      admin={admin}
      defaultAccountHex={defaultAccountHex}
      deskPrefetch={deskPrefetch}
      holdingsRows={holdingsRows}
      manageOptions={accountManageOptions}
      metrics={metrics}
      portfolioDisplayName={portfolioDisplayName}
      portfolioIdHex={portfolioIdHex}
      positionsByAccount={positionsByAccount}
      rows={tableRows}
      scoringFactors={scoringFactors}
      totalAccounts={accounts.length}
      portfolioStockSymbolsUpper={portfolioStockSymbolsUpper}
    />
  );
}
