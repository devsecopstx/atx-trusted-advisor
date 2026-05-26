import { buildXoptionsStrategyBuilderHref } from "@/lib/xoptions/xoptions-desk-deep-link";
import { mapScannerStrategySlugToChoiceId } from "@/lib/xoptions/xoptions-strategy-choice-url";
import type { HotPickCard } from "@/modules/portfolios/hot-picks-types";

function contractTypeFromPick(pick: HotPickCard): "call" | "put" | null {
  const leg = pick.legs.find((l) => l.strike > 0);
  if (leg?.right === "put" || leg?.right === "call") {
    return leg.right;
  }
  const strategyChoiceId = mapScannerStrategySlugToChoiceId(pick.strategy);
  if (strategyChoiceId === "covered-call" || strategyChoiceId === "long-call" || strategyChoiceId === "long-call-spread") {
    return "call";
  }
  if (
    strategyChoiceId === "cash-secured-put" ||
    strategyChoiceId === "short-put-spread" ||
    strategyChoiceId === "wheel-protective-collar"
  ) {
    return "put";
  }
  return null;
}

/** Hot Picks → xOptions step 4 with symbol, mapped strategy, and contract prefill when available. */
export function buildHotPickXoptionsStrategyBuilderHref(
  portfolioId: string | null,
  pick: HotPickCard
): string {
  const strategyChoiceId = mapScannerStrategySlugToChoiceId(pick.strategy);
  const leg = pick.legs.find((l) => l.strike > 0);
  const contractType = contractTypeFromPick(pick);
  const exp = pick.expirationYmd?.trim().slice(0, 10) ?? "";

  return buildXoptionsStrategyBuilderHref(portfolioId, pick.symbol, {
    step: 4,
    strategyChoiceId,
    contractPrefill:
      exp && /^\d{4}-\d{2}-\d{2}$/.test(exp) && leg && contractType
        ? {
            expirationYmd: exp,
            strike: leg.strike,
            contractType
          }
        : undefined
  });
}
