import type { XoptionsOrderReview } from "@/lib/xoptions/xoptions-order-preview";

export type XoptionsRiskAlertSeverity = "info" | "caution" | "warning";

export type XoptionsRiskAlert = {
  id: string;
  severity: XoptionsRiskAlertSeverity;
  title: string;
  plainEnglish: string;
  tooltipDefinition: string;
  metricKey?: string;
};

export type XoptionsReviewSummary = {
  annualizedYieldPercent: number | null;
  probabilityOtmPercent: number | null;
  dollarDeltaApproxUsd: number | null;
  samplePortfolioDeltaLine: string | null;
  assignmentProbabilityPercent: number | null;
};

export type XoptionsPortfolioImpact = {
  portfolioApproxValueUsd: number | null;
  maxLossUsd: number | null;
  maxLossPctOfPortfolio: number | null;
  holdingSharesForSymbol: number | null;
  securedNotionalUsd: number | null;
};

/** Active book context for HNWI review copy (find-options / workspace account). */
export type XoptionsPortfolioContext = {
  portfolioName: string | null;
  cashBalanceUsd: number | null;
  cashCollateralPctOfCash: number | null;
  symbolMarketValueUsd: number | null;
  symbolPctOfPortfolio: number | null;
};

export type XoptionsWhatIfAssigned = {
  newCostBasisPerShare: number | null;
  premiumCollectedPerShare: number | null;
  narrative: string;
};

export type XoptionsReviewAuditTrail = {
  weights: Array<{ id: string; label: string; weight: number }>;
  outlook: string | null;
  riskProfile: string | null;
  generatedAtUtc: string;
};

export type XoptionsStrategyOptionsReviewExtension = {
  reviewSummary: XoptionsReviewSummary;
  riskAlerts: XoptionsRiskAlert[];
  portfolioImpact: XoptionsPortfolioImpact;
  portfolioContext: XoptionsPortfolioContext;
  whatIfAssigned: XoptionsWhatIfAssigned | null;
  auditTrail: XoptionsReviewAuditTrail;
};

export type XoptionsReviewPayload = {
  symbol: string;
  contractId: string | null;
  orderReview: XoptionsOrderReview;
  extension: XoptionsStrategyOptionsReviewExtension;
};
