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

export type QuantTraderExportMeta = {
  generatedAtUtc: string;
  generatedAtLocal: string;
  params: QuantTraderRunParams;
  workspacePortfolioName?: string | null;
  simulationGeneratedAt?: string | null;
};

export function buildQuantTraderExportMeta(input: {
  params: QuantTraderRunParams;
  generatedAt?: Date;
  workspacePortfolioName?: string | null;
  simulationGeneratedAt?: string | null;
}): QuantTraderExportMeta {
  const at = input.generatedAt ?? new Date();
  return {
    generatedAtUtc: at.toISOString(),
    generatedAtLocal: at.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" }),
    params: input.params,
    workspacePortfolioName: input.workspacePortfolioName ?? null,
    simulationGeneratedAt: input.simulationGeneratedAt ?? null
  };
}

function escapeCsvField(value: string): string {
  if (/[",\n#]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function formatQuantTraderParamsSummary(params: QuantTraderRunParams): string {
  const risk = params.perPortfolioRisk
    ? "Per portfolio (desk profile)"
    : mcTierLabel(params.risk);
  const scope = params.portfolioScope === "all" ? "All owned portfolios" : "Workspace active portfolio";
  const strategy =
    params.strategyLabel?.trim() ||
    (params.symbol?.trim() ? `${params.symbol.trim().toUpperCase()} options` : null);
  const parts = [
    `${params.horizonDays}-day horizon`,
    `IV rank > ${params.minIvRankPct}%`,
    `max drawdown ${params.maxDrawdownPct}%`,
    `${params.pathCount.toLocaleString()} paths`,
    risk,
    scope
  ];
  if (strategy) {
    parts.push(strategy);
  }
  return parts.join(" · ");
}

export function quantTraderResultsToCsvWithMeta(
  result: MonteCarloTailRiskToolSuccess,
  meta: QuantTraderExportMeta
): string {
  const p = meta.params;
  const metaRows = [
    "# xFinance Quant Trader — Monte Carlo export",
    `# Report generated (local),${escapeCsvField(meta.generatedAtLocal)}`,
    `# Report generated (UTC),${meta.generatedAtUtc}`,
    `# Simulation generated (UTC),${meta.simulationGeneratedAt ?? result.generatedAt ?? ""}`,
    `# Horizon (days),${p.horizonDays}`,
    `# IV rank min (%),${p.minIvRankPct}`,
    `# Max drawdown (%),${p.maxDrawdownPct}`,
    `# Monte Carlo paths,${p.pathCount}`,
    `# Risk outlook,${escapeCsvField(p.perPortfolioRisk ? "per portfolio desk profile" : mcTierLabel(p.risk))}`,
    `# Portfolio scope,${escapeCsvField(p.portfolioScope === "all" ? "all owned portfolios" : "workspace active portfolio")}`,
    ...(p.strategyLabel?.trim()
      ? [`# Strategy,${escapeCsvField(p.strategyLabel.trim())}`]
      : []),
    ...(p.symbol?.trim() ? [`# Symbol,${p.symbol.trim().toUpperCase()}`] : []),
    ...(meta.workspacePortfolioName
      ? [`# Active workspace portfolio,${escapeCsvField(meta.workspacePortfolioName)}`]
      : []),
    `# Parameters summary,${escapeCsvField(formatQuantTraderParamsSummary(p))}`,
    `# Disclaimer,${escapeCsvField("Not investment advice. Simulations are model-based estimates.")}`,
    ""
  ];
  return [...metaRows, quantTraderResultsToCsv(result)].join("\n");
}

export function quantTraderExportFilenameStem(at: Date = new Date()): string {
  const iso = at.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `quant-trader-${iso}`;
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
