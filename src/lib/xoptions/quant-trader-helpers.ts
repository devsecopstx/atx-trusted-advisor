import type { McRiskTolerance } from "@/modules/strategy-options/monte-carlo-tail-risk";
import type { MonteCarloTailRiskToolSuccess } from "@/modules/xchat/monte-carlo-tail-risk-tool";

export type QuantTraderDeskRiskProfile = "conservative" | "balanced" | "growth" | null;

export type QuantTraderRunParams = {
  horizonDays: number;
  minIvRankPct: number;
  maxDrawdownPct: number;
  pathCount: number;
  risk: McRiskTolerance;
  perPortfolioRisk: boolean;
  portfolioScope: "all" | "workspace";
  strategyLabel?: string | null;
  symbol?: string | null;
};

export const QUANT_TRADER_DEFAULT_PARAMS: QuantTraderRunParams = {
  horizonDays: 45,
  minIvRankPct: 60,
  maxDrawdownPct: 15,
  pathCount: 12_000,
  risk: "aggressive",
  perPortfolioRisk: true,
  portfolioScope: "all"
};

export function mapDeskRiskProfileToMcTier(
  riskProfile: QuantTraderDeskRiskProfile
): McRiskTolerance {
  if (riskProfile === "conservative") {
    return "conservative";
  }
  if (riskProfile === "growth") {
    return "aggressive";
  }
  return "moderate";
}

export function mcTierLabel(tier: McRiskTolerance): string {
  if (tier === "conservative") {
    return "Conservative";
  }
  if (tier === "aggressive") {
    return "Aggressive";
  }
  return "Balanced";
}

export function buildQuantTraderXchatPrompt(params: QuantTraderRunParams): string {
  const strategy =
    params.strategyLabel?.trim() ||
    (params.symbol?.trim() ? `${params.symbol.trim().toUpperCase()} options` : "current strategy");
  return [
    `Run a Monte Carlo tail-risk simulation on my ${params.horizonDays}-day ${strategy} across my portfolios.`,
    `IV rank > ${params.minIvRankPct}%, max ${params.maxDrawdownPct}% drawdown, ${params.pathCount.toLocaleString()} paths.`,
    params.perPortfolioRisk
      ? "Use each portfolio's desk risk profile."
      : `Risk tier: ${mcTierLabel(params.risk)}.`
  ].join(" ");
}

export function quantTraderResultsToCsv(result: MonteCarloTailRiskToolSuccess): string {
  const header = [
    "portfolioId",
    "portfolioName",
    "holdingsCount",
    "var1dPct95",
    "var10dPct95",
    "cvar1dPct95",
    "cvar10dPct95",
    "probDrawdownGt20Pct",
    "drawdownGatePassed",
    "drawdownGateProbPct"
  ];
  const rows = result.portfolios.map((p) => {
    const t = p.tailRisk;
    return [
      p.portfolioId,
      `"${p.portfolioName.replace(/"/g, '""')}"`,
      String(p.holdingsCount),
      t ? t.var1dPct95.toFixed(4) : "",
      t ? t.var10dPct95.toFixed(4) : "",
      t ? t.cvar1dPct95.toFixed(4) : "",
      t ? t.cvar10dPct95.toFixed(4) : "",
      t ? (t.probDrawdownGt20Pct * 100).toFixed(4) : "",
      p.drawdownGate ? (p.drawdownGate.passed ? "yes" : "no") : "",
      p.drawdownGate ? p.drawdownGate.probDrawdownGtThresholdPct.toFixed(4) : ""
    ].join(",");
  });
  return [header.join(","), ...rows].join("\n");
}

export function estimateProbProfitPct(tailRisk: {
  probDrawdownGt20Pct: number;
} | null): number | null {
  if (!tailRisk) {
    return null;
  }
  return Math.max(0, Math.min(100, (1 - tailRisk.probDrawdownGt20Pct) * 100));
}
