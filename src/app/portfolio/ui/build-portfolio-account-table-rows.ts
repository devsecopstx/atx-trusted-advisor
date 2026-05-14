import type { PortfolioAccountTableRow } from "@/app/portfolio/ui/portfolio-accounts-section";
import { maskAccountXrefForDisplay } from "@/lib/account-xref-display";
import { brokerIconUrlForType, formatBrokerTypeLabel } from "@/lib/broker-ui";
import type { PortfolioAccountLiveRollup } from "@/lib/portfolio-account-live-metrics";
import {
    formatUsd2,
    formatUsdWhole,
    type PortfolioOverviewMetrics
} from "@/lib/portfolio-overview-metrics";
import { DESK_OUTLOOK_LABELS } from "@/modules/core-admin/desk-fields";
import { RISK_LEVEL_OPTIONS } from "@/modules/core-admin/portfolio-preference-labels";
import type { Account } from "@/modules/core-admin/types";

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

function formatSignedUsd2(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    signDisplay: "exceptZero",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatAccountQuantityLabel(stockQty: number, optionQty: number): string {
  const parts: string[] = [];
  if (stockQty !== 0) {
    const s =
      Number.isInteger(stockQty) && Math.abs(stockQty) < 1e12
        ? stockQty.toLocaleString("en-US")
        : stockQty.toLocaleString("en-US", { maximumFractionDigits: 2 });
    parts.push(`${s} sh`);
  }
  if (optionQty !== 0) {
    parts.push(
      `${optionQty.toLocaleString("en-US", { maximumFractionDigits: 2 })} opt`
    );
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function todayGainTone(dayGainUsd: number): "gain" | "loss" | "neutral" {
  if (dayGainUsd > 0) return "gain";
  if (dayGainUsd < 0) return "loss";
  return "neutral";
}

/** Shared by `/portfolio` overview and `/portfolios` dashboard account tables. */
export function buildPortfolioAccountTableRows(
  accounts: Account[],
  metrics: PortfolioOverviewMetrics,
  liveByAccountHex: Record<string, PortfolioAccountLiveRollup> = {}
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
    const hasCostBasis = row.positionRowCount > 0 || Math.abs(costBasis) > 0.005;
    const posLabel =
      row.positionRowCount +
      (row.optionLegCount > 0
        ? ` (${row.optionLegCount} opt. leg${row.optionLegCount === 1 ? "" : "s"})`
        : "");
    const live = liveByAccountHex[row.accountIdHex];
    const currentValueFormatted = live ? formatUsd2(live.marketValueUsd) : "—";
    const todayGainLossFormatted =
      live?.dayGainUsd != null ? formatSignedUsd2(live.dayGainUsd) : "—";
    const todayGainLossTone: "gain" | "loss" | "neutral" | "muted" =
      live?.dayGainUsd != null ? todayGainTone(live.dayGainUsd) : "muted";
    const pctOfPortfolioFormatted =
      live?.pctOfPortfolio != null ? `${live.pctOfPortfolio.toFixed(1)}%` : "—";
    const quantityLabel = live
      ? formatAccountQuantityLabel(live.stockQty, live.optionQty)
      : "—";
    return {
      accountIdHex: row.accountIdHex,
      name: row.name,
      isDefault: row.isDefault,
      deskLine,
      brokerTypeLabel: formatBrokerTypeLabel(row.brokerType),
      brokerIconUrl: brokerIconUrlForType(row.brokerType),
      extAccountId: maskAccountXrefForDisplay(row.extAccountId || ""),
      positionsLabel: posLabel,
      costBasisFormatted: hasCostBasis ? formatUsdWhole(costBasis) : "—",
      currentValueFormatted,
      todayGainLossFormatted,
      todayGainLossTone,
      pctOfPortfolioFormatted,
      quantityLabel,
      riskDotClassName: riskDotClass(acct)
    };
  });
}
