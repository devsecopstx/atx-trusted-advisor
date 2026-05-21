import type { SerializablePosition } from "@/app/portfolio/accounts/serializable-account";
import { buildPortfolioAccountTableRows } from "@/app/portfolio/ui/build-portfolio-account-table-rows";
import { PortfolioManageShell } from "@/app/portfolio/ui/portfolio-manage-shell";
import { maskAccountXrefForDisplay } from "@/lib/account-xref-display";
import { brokerIconSlugFromCatalogType, formatBrokerTypeLabel } from "@/lib/broker-ui";
import type { PortfolioAccountLiveRollup } from "@/lib/portfolio-account-live-metrics";
import type { PortfolioOverviewMetrics } from "@/lib/portfolio-overview-metrics";
import type { Account } from "@/modules/core-admin/types";

import type { PortfolioDeskPrefetchStrip } from "@/app/portfolio/ui/portfolio-desk-prefetch";

export type { PortfolioDeskPrefetchStrip };

type PortfolioOverviewProps = {
  portfolioDisplayName: string;
  portfolioIdHex: string;
  accounts: Account[];
  metrics: PortfolioOverviewMetrics;
  admin: boolean;
  positionsByAccount: Record<string, SerializablePosition[]>;
  /** Live marks / day P&L from Yahoo (same rules as Holdings); empty when omitted. */
  liveByAccountHex?: Record<string, PortfolioAccountLiveRollup>;
  deskPrefetch?: PortfolioDeskPrefetchStrip | null;
};

export function PortfolioOverview({
  portfolioDisplayName,
  portfolioIdHex,
  accounts,
  metrics,
  admin,
  positionsByAccount,
  liveByAccountHex = {},
  deskPrefetch = null
}: PortfolioOverviewProps) {
  const defaultAccountHex =
    metrics.byAccount.find((r) => r.isDefault)?.accountIdHex ?? metrics.byAccount[0]?.accountIdHex ?? "";

  const accountManageOptions = accounts
    .filter((account): account is Account & { _id: NonNullable<Account["_id"]> } => Boolean(account._id))
    .map((account) => ({
      id: account._id.toHexString(),
      name: account.name,
      isDefault: Boolean(account.isDefault),
      brokerTypeLabel: formatBrokerTypeLabel(account.type),
      brokerIconSlug: brokerIconSlugFromCatalogType(account.type),
      extAccountRefMasked: maskAccountXrefForDisplay(account.extAccountId ?? "")
    }));

  const tableRows = buildPortfolioAccountTableRows(accounts, metrics, liveByAccountHex);

  return (
    <PortfolioManageShell
      admin={admin}
      defaultAccountHex={defaultAccountHex}
      deskPrefetch={deskPrefetch}
      manageOptions={accountManageOptions}
      metrics={metrics}
      portfolioDisplayName={portfolioDisplayName}
      portfolioIdHex={portfolioIdHex}
      positionsByAccount={positionsByAccount}
      rows={tableRows}
      totalAccounts={accounts.length}
    />
  );
}
