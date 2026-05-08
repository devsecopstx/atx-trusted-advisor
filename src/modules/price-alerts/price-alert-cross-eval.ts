export type PriceAlertRuleKind = "above" | "below" | "crosses";

export type UserPriceRuleFireEval = {
  fire: boolean;
  nextLastReference: number;
};

/**
 * Pure crossing logic for NL price rules. First observation (no prior reference) arms only — no fire.
 */
export function evaluateUserPriceRuleCross(input: {
  ruleKind: PriceAlertRuleKind;
  targetPriceUsd: number;
  lastReferencePrice: number | undefined;
  currentPrice: number;
}): UserPriceRuleFireEval {
  const t = input.targetPriceUsd;
  const cur = input.currentPrice;
  const prev = input.lastReferencePrice;

  if (prev === undefined || !Number.isFinite(prev)) {
    return { fire: false, nextLastReference: cur };
  }

  if (input.ruleKind === "above") {
    return { fire: prev < t && cur >= t, nextLastReference: cur };
  }
  if (input.ruleKind === "below") {
    return { fire: prev > t && cur <= t, nextLastReference: cur };
  }
  return {
    fire: (prev < t && cur >= t) || (prev > t && cur <= t),
    nextLastReference: cur
  };
}
