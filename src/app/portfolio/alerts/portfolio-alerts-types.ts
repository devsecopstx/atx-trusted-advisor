export type PriceRuleRowVm = {
  readonly id: string;
  readonly symbol: string;
  readonly ruleKind: "above" | "below" | "crosses";
  readonly targetPriceUsd: number;
  readonly portfolioName: string | null;
  readonly lastReferencePrice: number | null;
  readonly status: string;
  readonly expiresAt: string;
  readonly updatedAt: string;
  readonly createdAt: string;
};
