import {
    buildXoptionsOrderReview,
    type XoptionsOpeningAction,
    type XoptionsOrderReview
} from "@/lib/xoptions/xoptions-order-preview";
import type {
    XoptionsPortfolioImpact,
    XoptionsReviewAuditTrail,
    XoptionsReviewPayload,
    XoptionsReviewSummary,
    XoptionsStrategyOptionsReviewExtension,
    XoptionsWhatIfAssigned
} from "@/lib/xoptions/xoptions-review-types";

import { buildXoptionsRiskAlerts } from "./risk-alert-service";

export type AssembleXoptionsReviewInput = {
  symbol: string;
  contractId: string | null;
  expirationYyyyMmDd: string;
  side: "call" | "put";
  openingAction: XoptionsOpeningAction;
  strike: number;
  limitPrice: string;
  quantity: string;
  spot: number;
  impliedVolatilityPercent: number | null | undefined;
  strategyLabel: string | null;
  legDelta: number | null | undefined;
  portfolioApproxValueUsd: number | null;
  holdingSharesForSymbol: number | null;
  earningsDateIso: string | null;
  auditTrail: Omit<XoptionsReviewAuditTrail, "generatedAtUtc">;
};

function buildReviewSummary(orderReview: XoptionsOrderReview): XoptionsReviewSummary {
  const assignmentProbabilityPercent =
    orderReview.probabilityOtmPercent != null
      ? Math.min(100, Math.max(0, 100 - orderReview.probabilityOtmPercent))
      : null;

  return {
    annualizedYieldPercent: orderReview.annualizedPremiumYieldPercent,
    probabilityOtmPercent: orderReview.probabilityOtmPercent,
    dollarDeltaApproxUsd: orderReview.dollarDeltaApproxUsd,
    samplePortfolioDeltaLine: orderReview.samplePortfolioDeltaLine,
    assignmentProbabilityPercent
  };
}

function buildPortfolioImpact(input: {
  orderReview: XoptionsOrderReview;
  openingAction: XoptionsOpeningAction;
  strike: number;
  quantity: string;
  portfolioApproxValueUsd: number | null;
  holdingSharesForSymbol: number | null;
}): XoptionsPortfolioImpact {
  const qty = Math.max(1, Number.parseInt(input.quantity, 10) || 1);
  const shares = qty * 100;
  const securedNotionalUsd =
    input.openingAction === "sell_to_open" && Number.isFinite(input.strike) && input.strike > 0
      ? input.strike * shares
      : null;
  const maxLossUsd = input.orderReview.maxLossUsd;
  const maxLossPctOfPortfolio =
    maxLossUsd != null &&
    input.portfolioApproxValueUsd != null &&
    input.portfolioApproxValueUsd > 0
      ? (maxLossUsd / input.portfolioApproxValueUsd) * 100
      : null;

  return {
    portfolioApproxValueUsd: input.portfolioApproxValueUsd,
    maxLossUsd,
    maxLossPctOfPortfolio,
    holdingSharesForSymbol: input.holdingSharesForSymbol,
    securedNotionalUsd
  };
}

function buildWhatIfAssigned(input: {
  symbol: string;
  side: "call" | "put";
  openingAction: XoptionsOpeningAction;
  strike: number;
  premiumPerShare: number;
}): XoptionsWhatIfAssigned | null {
  if (input.openingAction !== "sell_to_open") {
    return null;
  }

  const sym = input.symbol.trim().toUpperCase();
  const premium = Math.max(0, input.premiumPerShare);

  if (input.side === "put") {
    const newCostBasisPerShare = Math.max(0, input.strike - premium);
    return {
      newCostBasisPerShare,
      premiumCollectedPerShare: premium,
      narrative: `If assigned on the ${sym} put, your effective stock cost basis would be about $${newCostBasisPerShare.toFixed(2)} per share after the $${premium.toFixed(2)} premium collected.`
    };
  }

  return {
    newCostBasisPerShare: null,
    premiumCollectedPerShare: premium,
    narrative: `If assigned on the ${sym} call, you would deliver shares at $${input.strike.toFixed(2)} while keeping the $${premium.toFixed(2)} premium collected per share.`
  };
}

export function assembleXoptionsReviewPayload(input: AssembleXoptionsReviewInput): XoptionsReviewPayload {
  const orderReview = buildXoptionsOrderReview({
    symbol: input.symbol,
    expirationYyyyMmDd: input.expirationYyyyMmDd,
    side: input.side,
    openingAction: input.openingAction,
    strike: input.strike,
    limitPrice: input.limitPrice,
    quantity: input.quantity,
    spot: input.spot,
    impliedVolatilityPercent: input.impliedVolatilityPercent,
    strategyLabel: input.strategyLabel,
    legDelta: input.legDelta
  });

  const premiumPerShare = Number.parseFloat(input.limitPrice.trim());
  const extension: XoptionsStrategyOptionsReviewExtension = {
    reviewSummary: buildReviewSummary(orderReview),
    riskAlerts: buildXoptionsRiskAlerts({
      symbol: input.symbol,
      side: input.side,
      openingAction: input.openingAction,
      expirationYyyyMmDd: input.expirationYyyyMmDd,
      impliedVolatilityPercent: input.impliedVolatilityPercent,
      probabilityOtmPercent: orderReview.probabilityOtmPercent,
      earningsDateIso: input.earningsDateIso
    }),
    portfolioImpact: buildPortfolioImpact({
      orderReview,
      openingAction: input.openingAction,
      strike: input.strike,
      quantity: input.quantity,
      portfolioApproxValueUsd: input.portfolioApproxValueUsd,
      holdingSharesForSymbol: input.holdingSharesForSymbol
    }),
    whatIfAssigned: buildWhatIfAssigned({
      symbol: input.symbol,
      side: input.side,
      openingAction: input.openingAction,
      strike: input.strike,
      premiumPerShare: Number.isFinite(premiumPerShare) ? premiumPerShare : 0
    }),
    auditTrail: {
      ...input.auditTrail,
      generatedAtUtc: new Date().toISOString()
    }
  };

  return {
    symbol: input.symbol.trim().toUpperCase(),
    contractId: input.contractId,
    orderReview,
    extension
  };
}
