import {
    parsePortfolioAlertUserPriceRuleMetadata,
    type PortfolioAlertUserPriceRuleMetadataV1
} from "@/lib/portfolio-alert-user-price-rule-metadata";
import {
    adminCreatePortfolioAlert,
    adminDeletePortfolioAlert,
    adminPatchUserPriceRuleMetadataPrices,
    listArmedUserPriceAlertRulesForPortfolio
} from "@/modules/core-admin/repository";
import { dispatchPortfolioDeskEvents } from "@/modules/notifications/portfolio-notification-service";

export type UserPriceRuleFireEval = {
  fire: boolean;
  nextLastReference: number;
};

/**
 * Pure crossing logic for NL price rules. First observation (no prior reference) arms only — no fire.
 */
export function evaluateUserPriceRuleCross(input: {
  ruleKind: PortfolioAlertUserPriceRuleMetadataV1["ruleKind"];
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

export type ProcessUserPriceRulesResult = {
  evaluated: number;
  armedUpdates: number;
  fired: number;
};

/**
 * Tenant-safe: loads rules via portfolio-scoped repository (owner + tenant match).
 * Called from watchlist price scanner with Yahoo quote map for the tenant sweep.
 */
export async function processUserPriceRulesForPortfolio(
  portfolioIdHex: string,
  quotePriceBySymbolUpper: Map<string, number>
): Promise<ProcessUserPriceRulesResult> {
  const rules = await listArmedUserPriceAlertRulesForPortfolio(portfolioIdHex);
  let armedUpdates = 0;
  let fired = 0;

  for (const row of rules) {
    const meta = parsePortfolioAlertUserPriceRuleMetadata(row.metadata);
    if (!meta || meta.ruleState !== "armed") {
      continue;
    }
    const sym = row.symbol?.trim().toUpperCase();
    if (!sym) {
      continue;
    }
    const px = quotePriceBySymbolUpper.get(sym);
    if (px === undefined || !Number.isFinite(px)) {
      continue;
    }

    const evalResult = evaluateUserPriceRuleCross({
      ruleKind: meta.ruleKind,
      targetPriceUsd: meta.targetPriceUsd,
      lastReferencePrice: meta.lastReferencePrice,
      currentPrice: px
    });

    const id = row._id?.toHexString();
    if (!id) {
      continue;
    }

    if (!evalResult.fire) {
      if (meta.lastReferencePrice !== evalResult.nextLastReference) {
        const ok = await adminPatchUserPriceRuleMetadataPrices(portfolioIdHex, id, {
          lastReferencePrice: evalResult.nextLastReference
        });
        if (ok) {
          armedUpdates += 1;
        }
      }
      continue;
    }

    const deleted = await adminDeletePortfolioAlert(portfolioIdHex, id);
    if (!deleted) {
      continue;
    }

    const title = `${sym} hit your ${meta.ruleKind} $${meta.targetPriceUsd.toFixed(2)} rule`;
    const body = `Last desk quote ~$${px.toFixed(2)} vs target $${meta.targetPriceUsd.toFixed(2)} (${meta.ruleKind}).`;
    const created = await adminCreatePortfolioAlert({
      portfolioId: portfolioIdHex,
      title,
      body,
      severity: "info",
      status: "active",
      symbol: sym,
      accountContext: "watchlist"
    });

    if (created?._id) {
      fired += 1;
      try {
        await dispatchPortfolioDeskEvents(portfolioIdHex, [{ title, body, symbol: sym }]);
      } catch (error) {
        console.warn("[user-price-rules] desk dispatch failed", {
          portfolioIdPrefix: portfolioIdHex.slice(0, 8),
          symbol: sym,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  return { evaluated: rules.length, armedUpdates, fired };
}
