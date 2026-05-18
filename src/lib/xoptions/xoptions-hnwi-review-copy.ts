import {
    daysToExpirationUtc,
    formatExpirationShortLabel,
    type XoptionsOpeningAction,
    type XoptionsOrderReview
} from "@/lib/xoptions/xoptions-order-preview";
import {
    DESK_OUTLOOK_LABELS,
    DESK_RISK_DISPLAY_LABELS,
    type DeskRiskProfileOption
} from "@/modules/core-admin/desk-fields";
import type { AccountOutlook } from "@/modules/core-admin/types";

export type XoptionsHnwiReviewCopyInput = {
  symbol: string;
  side: "call" | "put";
  openingAction: XoptionsOpeningAction;
  strike: number;
  expirationYyyyMmDd: string;
  quantity: number;
  limitPricePerShare: number;
  orderReview: XoptionsOrderReview;
  strategyLabel: string | null;
  outlookSlug: AccountOutlook | string | null;
  riskProfileSlug: DeskRiskProfileOption | string | null;
  portfolioName: string | null;
  cashBalanceUsd: number | null;
  securedNotionalUsd: number | null;
  impliedVolatilityElevated: boolean;
};

function usd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function formatOpeningActionTitle(action: XoptionsOpeningAction): string {
  return action === "sell_to_open" ? "Sell to Open" : "Buy to Open";
}

export function resolveOutlookDisplayLabel(outlook: string | null | undefined): string | null {
  if (!outlook?.trim()) {
    return null;
  }
  const slug = outlook.trim().toLowerCase();
  if (slug === "bullish" || slug === "neutral" || slug === "bearish") {
    return DESK_OUTLOOK_LABELS[slug];
  }
  return outlook.trim();
}

export function resolveRiskProfileDisplayLabel(risk: string | null | undefined): string | null {
  if (!risk?.trim()) {
    return null;
  }
  const slug = risk.trim().toLowerCase();
  if (slug === "conservative" || slug === "balanced" || slug === "growth") {
    return DESK_RISK_DISPLAY_LABELS[slug];
  }
  return risk.trim();
}

export function buildHnwiOutlookRiskTag(
  outlook: string | null | undefined,
  riskProfile: string | null | undefined
): string | null {
  const o = resolveOutlookDisplayLabel(outlook);
  const r = resolveRiskProfileDisplayLabel(riskProfile);
  if (o && r) {
    const outlookShort = o.split("/")[0]?.trim() ?? o;
    return `${outlookShort} / ${r} outlook`;
  }
  if (o) {
    return o;
  }
  if (r) {
    return `${r} outlook`;
  }
  return null;
}

export function buildHnwiOrderSummaryHeadline(input: XoptionsHnwiReviewCopyInput): string {
  const sym = input.symbol.trim().toUpperCase();
  const exp = formatExpirationShortLabel(input.expirationYyyyMmDd);
  const right = input.side === "call" ? "Call" : "Put";
  const verb = formatOpeningActionTitle(input.openingAction);
  const contracts = Math.max(1, input.quantity);
  const limit = input.limitPricePerShare;
  const premium = input.orderReview.grossPremiumUsd;
  const flow =
    input.openingAction === "sell_to_open"
      ? `Estimated premium credit ${usd(premium)}`
      : `Estimated premium debit ${usd(premium)}`;
  return `${verb} ${contracts} contract${contracts === 1 ? "" : "s"} of the ${exp} $${input.strike.toFixed(2)} ${right} (${sym})\n@ $${limit.toFixed(2)} per share → ${flow}`;
}

export function buildHnwiOrderSummaryMetaLine(input: XoptionsHnwiReviewCopyInput): string {
  const dte = daysToExpirationUtc(input.expirationYyyyMmDd);
  const strategy =
    input.strategyLabel?.trim() ||
    (input.side === "put" && input.openingAction === "sell_to_open"
      ? "Cash-secured put"
      : input.side === "call" && input.openingAction === "sell_to_open"
        ? "Covered call"
        : "Single-leg option");
  const outlookTag = buildHnwiOutlookRiskTag(input.outlookSlug, input.riskProfileSlug);
  const parts = [`${strategy}`, `~${dte} day${dte === 1 ? "" : "s"} to expiration`];
  if (outlookTag) {
    parts.push(outlookTag);
  }
  return parts.join(" • ");
}

export function buildHnwiExecutiveAdvisorNote(input: XoptionsHnwiReviewCopyInput): string {
  const sym = input.symbol.trim().toUpperCase();
  const dte = daysToExpirationUtc(input.expirationYyyyMmDd);
  const strategy =
    input.strategyLabel?.trim() ||
    (input.side === "put" && input.openingAction === "sell_to_open" ? "cash-secured put" : "option");
  const outlookShort =
    resolveOutlookDisplayLabel(input.outlookSlug)?.split("/")[0]?.trim().toLowerCase() ?? "desk";
  const riskLabel = resolveRiskProfileDisplayLabel(input.riskProfileSlug)?.toLowerCase() ?? "risk";
  const collateral =
    input.securedNotionalUsd != null && input.securedNotionalUsd > 0
      ? usd(input.securedNotionalUsd)
      : input.orderReview.capitalAtRiskDisplay;
  const cashPct =
    input.securedNotionalUsd != null &&
    input.cashBalanceUsd != null &&
    input.cashBalanceUsd > 0
      ? Math.round((input.securedNotionalUsd / input.cashBalanceUsd) * 100)
      : null;
  const portfolioRef = input.portfolioName?.trim() ? input.portfolioName.trim() : "portfolio";
  const incomeClause =
    input.openingAction === "sell_to_open"
      ? "It generates immediate income while requiring"
      : "It commits premium while requiring";
  const cashClause =
    cashPct != null
      ? ` (approximately ${cashPct}% of ${portfolioRef} cash balance)`
      : input.portfolioName
        ? ` against ${portfolioRef} cash availability`
        : "";
  const ivClause = input.impliedVolatilityElevated
    ? " and benefits from the current elevated implied volatility."
    : ".";
  return `This ~${dte}d ${strategy} aligns with your ${outlookShort} outlook on ${sym}. ${incomeClause} ${collateral} of cash collateral${cashClause}. The trade is sized within your ${riskLabel} sleeve${ivClause}`;
}

export function buildHnwiBreakevenMetricValue(orderReview: XoptionsOrderReview): string {
  const pop = orderReview.probabilityProfitDisplay;
  if (pop && pop !== "—") {
    return `${orderReview.breakevenDisplay} (${pop} POP)`;
  }
  return orderReview.breakevenDisplay;
}

export function buildHnwiTradeThesis(input: {
  strategyLabel: string | null;
  outlookSlug: string | null;
  riskProfileSlug: string | null;
  orderReview: XoptionsOrderReview;
}): string {
  const outlook = resolveOutlookDisplayLabel(input.outlookSlug);
  const risk = resolveRiskProfileDisplayLabel(input.riskProfileSlug);
  const strategy = input.strategyLabel?.trim() || "This structure";
  const outlookClause = outlook ? ` under a ${outlook} desk view` : "";
  const riskClause = risk ? ` within the ${risk} risk sleeve` : "";
  return `${strategy}${outlookClause}${riskClause}. ${input.orderReview.strategyOneLiner}`;
}
