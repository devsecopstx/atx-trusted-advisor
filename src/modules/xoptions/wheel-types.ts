export type WheelRiskTolerance = "conservative" | "balanced" | "aggressive";

export type WheelExpirationCycle = "weekly" | "monthly" | "quarterly";

export type WheelReportStyle = "executive" | "institutional";

export type WheelReentryRule = "roll_immediately" | "wait_pullback" | "stagger_reentry";

export type WheelStrategyTemplate = {
  key: string;
  label: string;
  ticker: string;
  note: string;
  riskTolerance: WheelRiskTolerance;
  expirationCycle: WheelExpirationCycle;
  targetPutDelta: number;
  targetCallDelta: number;
  minimumPremiumYieldPerCyclePct: number;
};

export type WheelGeneratorInput = {
  ticker: string;
  availableCapitalUsd: number;
  riskTolerance: WheelRiskTolerance;
  expirationCycle: WheelExpirationCycle;
  targetPutDelta: number;
  targetCallDelta: number;
  minimumPremiumYieldPerCyclePct: number;
  maxPositionSizePct: number;
  reentryRule: WheelReentryRule;
  ivPercentileMin?: number | null;
  avoidEarningsWeek: boolean;
  sectorPreference?: string | null;
  taxConsideration?: "tax_deferred" | "taxable" | "mixed" | null;
  variationCount: 3 | 4 | 5;
  reportStyle: WheelReportStyle;
};

export type WheelUnderlyingSnapshot = {
  ticker: string;
  spotPrice: number;
  currency: string;
  ivRankPercent: number | null;
  earningsDateIso: string | null;
  earningsWithin14Days: boolean;
  sector: string | null;
};

export type WheelContractLeg = {
  strike: number;
  expiration: string;
  premium: number;
  bid: number;
  ask: number;
  impliedVolatilityPct: number;
  delta: number | null;
  gamma: number | null;
  thetaPerDay: number | null;
  vegaPerOnePercentIv: number | null;
};

export type WheelIdea = {
  ideaId: string;
  headline: string;
  putLeg: WheelContractLeg;
  callLeg: WheelContractLeg;
  contracts: number;
  requiredCapitalUsd: number;
  premiumIncomePerCycleUsd: number;
  annualizedYieldPct: number;
  assignmentProbabilityPct: number;
  callAwayProbabilityPct: number;
  maxCapitalAtRiskUsd: number;
  greeksSnapshot: {
    delta: number;
    gamma: number;
    thetaPerDay: number;
    vegaPerOnePercentIv: number;
  };
  cycleBreakdown: string[];
  whyThisWorks: string;
};

export type WheelPortfolioFit = {
  tickerAlreadyHeld: boolean;
  currentHoldingMarketValueUsd: number;
  projectedAllocationPct: number;
  fitLabel: "fits_policy" | "concentrated" | "over_limit";
  note: string;
};

export type WheelRelatedSupplierCandidate = {
  symbol: string;
  companyName: string;
  relationship: string;
  spotPrice: number;
  avgImpliedVolatilityPct: number;
  estimatedWheelYieldPct: number;
  momentum30dPct: number;
  score: number;
  rationale: string;
};

export type WheelRelatedSuppliers = {
  rootTicker: string;
  universeScanned: number;
  topCandidates: WheelRelatedSupplierCandidate[];
  selectionRule: string;
};

export type WheelGeneratedPayload = {
  generatedAtIso: string;
  input: WheelGeneratorInput;
  rootSnapshot: WheelUnderlyingSnapshot;
  ideas: WheelIdea[];
  portfolioFit: WheelPortfolioFit;
  relatedSuppliers: WheelRelatedSuppliers;
  executiveSummary: string;
  monitoringRules: string[];
  disclaimer: string;
};

export type WheelPersistedReport = {
  reportId: string;
  generatedByUserId: string;
  generatedByName: string;
  tenantId?: string;
  payload: WheelGeneratedPayload;
  createdAtIso: string;
};
