import type { WheelIdea } from "./wheel-types";

/**
 * Premium collected for one full wheel cycle (put + call credits) as % of put collateral
 * (`requiredCapitalUsd`). Aligns with generator economics; annualized scales this by 365/DTE separately.
 */
export function yieldPerCyclePctOfCapital(
  idea: Pick<WheelIdea, "premiumIncomePerCycleUsd" | "requiredCapitalUsd">
): number {
  return (idea.premiumIncomePerCycleUsd / Math.max(idea.requiredCapitalUsd, 1e-9)) * 100;
}
