import type { InvestmentStrategy, PortfolioSettings, UserAdminSettings } from "@/modules/core-admin/types";

export type RiskProfileValue = PortfolioSettings["riskProfile"];

/** UI tier (mock): Low / Medium / High — maps to stored `riskProfile`. */
export const RISK_LEVEL_OPTIONS: ReadonlyArray<{
  tier: "low" | "medium" | "high";
  label: string;
  riskProfile: RiskProfileValue;
  dotClass: string;
}> = [
  { tier: "low", label: "Low", riskProfile: "conservative", dotClass: "bg-emerald-500" },
  { tier: "medium", label: "Medium", riskProfile: "balanced", dotClass: "bg-amber-400" },
  { tier: "high", label: "High", riskProfile: "growth", dotClass: "bg-red-500" }
];

export const INVESTMENT_STRATEGY_OPTIONS: ReadonlyArray<{
  value: InvestmentStrategy;
  title: string;
  description: string;
}> = [
  { value: "growth", title: "Growth", description: "Focus on capital appreciation" },
  { value: "income", title: "Income", description: "Focus on dividends and yield" },
  { value: "balanced", title: "Balanced", description: "Mix of growth and income" },
  { value: "aggressive", title: "Aggressive", description: "High risk, high reward" }
];

export const DEFAULT_INVESTMENT_STRATEGY: InvestmentStrategy = "balanced";

export function withDefaultInvestmentStrategy(settings: UserAdminSettings): UserAdminSettings {
  return {
    ...settings,
    portfolio: {
      ...settings.portfolio,
      investmentStrategy: settings.portfolio.investmentStrategy ?? DEFAULT_INVESTMENT_STRATEGY
    }
  };
}
