import {
  DEFAULT_OPTION_SCANNER_THRESHOLDS,
  deriveOptionScannerThresholdsFromScoringFactors,
  type OptionScannerRuleThresholds
} from "@/lib/option-scanner-thresholds";
import { adminGetPortfolioById } from "@/modules/core-admin/repository";
import {
  DEFAULT_PORTFOLIO_SCORING_FACTORS,
  resolveEffectivePortfolioScoringFactors,
  type PortfolioScoringFactor
} from "@/modules/core-admin/scoring-factors";
import { getTenantByHexId } from "@/modules/identity/repository";

export type OptionScannerPortfolioContext = {
  scoringFactors: PortfolioScoringFactor[];
  thresholds: OptionScannerRuleThresholds;
};

export function defaultOptionScannerPortfolioContext(): OptionScannerPortfolioContext {
  return {
    scoringFactors: DEFAULT_PORTFOLIO_SCORING_FACTORS.map((r) => ({ ...r })),
    thresholds: { ...DEFAULT_OPTION_SCANNER_THRESHOLDS }
  };
}

/**
 * Loads effective scoring factors (portfolio row → tenant default → catalog) and derives desk thresholds.
 */
export async function loadOptionScannerPortfolioContexts(
  portfolioIdsHex: string[]
): Promise<Map<string, OptionScannerPortfolioContext>> {
  const unique = [...new Set(portfolioIdsHex.map((id) => id.trim()).filter(Boolean))];
  const out = new Map<string, OptionScannerPortfolioContext>();
  const tenantCache = new Map<string, Awaited<ReturnType<typeof getTenantByHexId>>>();

  await Promise.all(
    unique.map(async (pid) => {
      const portfolio = await adminGetPortfolioById(pid);
      if (!portfolio?._id) {
        out.set(pid, defaultOptionScannerPortfolioContext());
        return;
      }
      const th = portfolio.tenantId?.toHexString();
      let tenantDefault: unknown;
      if (th) {
        if (!tenantCache.has(th)) {
          tenantCache.set(th, await getTenantByHexId(th));
        }
        tenantDefault = tenantCache.get(th)?.defaultPortfolioScoringFactors ?? undefined;
      }
      const scoringFactors = resolveEffectivePortfolioScoringFactors(portfolio.scoringFactors, tenantDefault);
      const thresholds = deriveOptionScannerThresholdsFromScoringFactors(scoringFactors);
      out.set(pid, { scoringFactors, thresholds });
    })
  );

  return out;
}
