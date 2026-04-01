import type { PortfolioAccountTableRow } from "@/app/portfolio/ui/portfolio-accounts-section";
import {
    formatUsdWhole,
    type PortfolioOverviewMetrics
} from "@/lib/portfolio-overview-metrics";
import { DESK_OUTLOOK_LABELS } from "@/modules/core-admin/desk-fields";
import { RISK_LEVEL_OPTIONS } from "@/modules/core-admin/portfolio-preference-labels";
import type { Account } from "@/modules/core-admin/types";

function formatBrokerType(type: string): string {
  return type
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function accountByHex(accounts: Account[], hex: string): Account | undefined {
  return accounts.find((a) => a._id?.toHexString() === hex);
}

function riskDotClass(account: Account | undefined): string {
  const rp = account?.riskProfile;
  if (rp === "conservative") return "portfolio-risk-dot portfolio-risk-dot--low";
  if (rp === "balanced") return "portfolio-risk-dot portfolio-risk-dot--medium";
  if (rp === "growth") return "portfolio-risk-dot portfolio-risk-dot--high";
  return "portfolio-risk-dot portfolio-risk-dot--unset";
}

/** Shared by `/portfolio` overview and `/portfolios` dashboard account tables. */
export function buildPortfolioAccountTableRows(
  accounts: Account[],
  metrics: PortfolioOverviewMetrics
): PortfolioAccountTableRow[] {
  return metrics.byAccount.map((row) => {
    const acct = accountByHex(accounts, row.accountIdHex);
    const riskLabel =
      acct?.riskProfile != null
        ? RISK_LEVEL_OPTIONS.find((r) => r.riskProfile === acct.riskProfile)?.label
        : null;
    const outlookTitle = acct?.outlook != null ? DESK_OUTLOOK_LABELS[acct.outlook] : null;
    const deskBits = [outlookTitle ?? null, riskLabel ? `${riskLabel} risk` : null].filter(Boolean);
    const deskLine = deskBits.length > 0 ? deskBits.join(" · ") : "Desk not set";
    const costBasis = row.valueExcludingOptions + row.optionBookValue;
    const posLabel =
      row.positionRowCount +
      (row.optionLegCount > 0
        ? ` (${row.optionLegCount} opt. leg${row.optionLegCount === 1 ? "" : "s"})`
        : "");
    return {
      accountIdHex: row.accountIdHex,
      name: row.name,
      isDefault: row.isDefault,
      deskLine,
      brokerTypeLabel: formatBrokerType(row.brokerType),
      extAccountId: row.extAccountId || "",
      positionsLabel: posLabel,
      costBasisFormatted: formatUsdWhole(costBasis),
      riskDotClassName: riskDotClass(acct)
    };
  });
}
