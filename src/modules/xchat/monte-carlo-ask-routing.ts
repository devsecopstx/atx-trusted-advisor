import type { McRiskTolerance } from "@/modules/strategy-options/monte-carlo-tail-risk";

import type { MonteCarloTailRiskToolSuccess } from "@/modules/xchat/monte-carlo-tail-risk-tool";

export type MonteCarloAskNlParams = {
  horizonDays: number;
  minIvRankPct?: number;
  maxDrawdownPct?: number;
  portfolioScope: "all" | "workspace";
  risk?: McRiskTolerance;
  /** When true, each portfolio uses its desk `riskLevel` / account risk profile. */
  perPortfolioRisk: boolean;
  mentionedPortfolioCount?: number;
};

/** True when the user asks for Monte Carlo / tail-risk simulation (quant-trader direct path). */
export function shouldRunMonteCarloTailRiskDirect(message: string): boolean {
  const m = message.trim();
  if (!m) {
    return false;
  }
  return /\bmonte\s*carlo\b/i.test(m) || /\btail[\s-]?risk\s+(sim|simulation|on)\b/i.test(m);
}

/** Multi-book scope phrases — never ask the user to pick portfolios when these match. */
export function isMultiPortfolioMonteCarloScope(message: string): boolean {
  const m = message.trim().toLowerCase();
  return (
    /\bacross\b[\s\S]{0,40}\bportfolios?\b/.test(m) ||
    /\ball\b[\s\S]{0,24}\bportfolios?\b/.test(m) ||
    /\bevery\b[\s\S]{0,24}\bportfolios?\b/.test(m) ||
    /\b(my|our)\s+\d+\s+portfolios?\b/.test(m) ||
    /\b(my|our)\s+portfolios?\b/.test(m) ||
    /\beach portfolio\b/.test(m) ||
    /\bmulti[- ]?book\b/.test(m)
  );
}

const WORD_COUNT_TO_INT: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5
};

function parseMentionedPortfolioCount(message: string): number | undefined {
  const digitMatch = message.match(/\b(?:my|our)\s+(\d+)\s+portfolios?\b/i);
  if (digitMatch?.[1]) {
    const n = Number.parseInt(digitMatch[1], 10);
    return Number.isFinite(n) ? n : undefined;
  }
  const wordMatch = message.match(
    /\b(?:my|our)\s+(one|two|three|four|five)\s+portfolios?\b/i
  );
  if (wordMatch?.[1]) {
    return WORD_COUNT_TO_INT[wordMatch[1].toLowerCase()];
  }
  return undefined;
}

/** Parse common NL Monte Carlo filters from the user message (wheel / IV rank / drawdown / horizon). */
export function parseMonteCarloAskNlParams(message: string): MonteCarloAskNlParams | null {
  if (!shouldRunMonteCarloTailRiskDirect(message)) {
    return null;
  }

  const horizonMatch = message.match(/\b(\d{1,3})\s*[- ]?\s*day/i);
  const horizonRaw = horizonMatch ? Number.parseInt(horizonMatch[1] ?? "45", 10) : 45;
  const horizonDays = Number.isFinite(horizonRaw)
    ? Math.min(365, Math.max(1, horizonRaw))
    : 45;

  const ivMatch = message.match(/iv\s*rank\s*(?:>\s*|above\s*|≥\s*|over\s*)?(\d{1,2})\s*%?/i);
  const minIvRankPct =
    ivMatch && ivMatch[1] ? Math.min(99, Math.max(1, Number.parseInt(ivMatch[1], 10))) : undefined;

  const ddMatch =
    message.match(/max(?:imum)?\s*(\d{1,2})\s*%\s*drawdown/i) ??
    message.match(/drawdown\s*(?:<\s*|under\s*|≤\s*|max\s*)?(\d{1,2})\s*%/i);
  const maxDrawdownPct =
    ddMatch && ddMatch[1] ? Math.min(99, Math.max(1, Number.parseInt(ddMatch[1], 10))) : undefined;

  const multiPortfolio = isMultiPortfolioMonteCarloScope(message);
  const mentionedPortfolioCount = parseMentionedPortfolioCount(message);

  let risk: McRiskTolerance | undefined;
  if (/\bconservative\b/i.test(message)) {
    risk = "conservative";
  } else if (/\baggressive\b/i.test(message)) {
    risk = "aggressive";
  } else if (/\b(moderate|balanced)\b/i.test(message)) {
    risk = "moderate";
  }

  return {
    horizonDays,
    ...(minIvRankPct != null ? { minIvRankPct } : {}),
    ...(maxDrawdownPct != null ? { maxDrawdownPct } : {}),
    portfolioScope: multiPortfolio ? "all" : "workspace",
    perPortfolioRisk: multiPortfolio && risk == null,
    ...(risk ? { risk } : {}),
    ...(mentionedPortfolioCount != null && Number.isFinite(mentionedPortfolioCount)
      ? { mentionedPortfolioCount }
      : {})
  };
}

export function buildMonteCarloToolArgsFromNl(
  nl: MonteCarloAskNlParams
): Record<string, unknown> {
  return {
    ...(nl.portfolioScope === "all" ? { portfolioScope: "all" as const } : {}),
    horizonDays: nl.horizonDays,
    ...(nl.minIvRankPct != null ? { minIvRankPct: nl.minIvRankPct } : {}),
    ...(nl.maxDrawdownPct != null ? { maxDrawdownPct: nl.maxDrawdownPct } : {}),
    ...(nl.risk ? { risk: nl.risk } : { risk: "moderate" as const }),
    ...(nl.perPortfolioRisk ? { perPortfolioRisk: true } : {})
  };
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function renderMonteCarloTailRiskMarkdown(
  result: MonteCarloTailRiskToolSuccess,
  options?: { mentionedPortfolioCount?: number }
): string {
  const lines: string[] = [
    "### Monte Carlo tail-risk (book-level)",
    "",
    `Horizon: **${result.horizonDays}** days · paths: **${result.portfolios.find((p) => p.tailRisk)?.tailRisk?.paths ?? "—"}**`,
    ""
  ];

  if (
    options?.mentionedPortfolioCount != null &&
    options.mentionedPortfolioCount !== result.portfolios.length
  ) {
    lines.push(
      `> Workspace lists **${result.portfolios.length}** owned portfolio(s); you mentioned **${options.mentionedPortfolioCount}** — simulated all books in preflight.`,
      ""
    );
  }

  if (result.minIvRankPct != null) {
    lines.push(`IV rank floor: **≥ ${result.minIvRankPct}%** (symbols filtered per book).`, "");
  }

  for (const book of result.portfolios) {
    lines.push(`#### ${book.portfolioName} (\`${book.portfolioId.slice(0, 8)}…\`)`);
    if (!book.tailRisk || book.holdingsCount === 0) {
      lines.push(
        book.filteredSymbols && book.filteredSymbols.length === 0
          ? "_No holdings passed IV rank filter._"
          : "_No equity holdings to simulate._",
        ""
      );
      continue;
    }
    const t = book.tailRisk;
    lines.push(
      `- **1D VaR (95%)** ${pct(t.var1dPct95)} · **10D VaR** ${pct(t.var10dPct95)}`,
      `- **CVaR (1D / 10D)** ${pct(t.cvar1dPct95)} / ${pct(t.cvar10dPct95)}`,
      `- **P(drawdown > 20%)** ${pct(t.probDrawdownGt20Pct * 100)}`,
      `- Stress 2020 vol: 1D VaR ${pct(t.stress2020VolSpike.var1dPct)} · correlation crush CVaR ${pct(t.stressCorrelationCrush.cvar1dPct)}`
    );
    if (book.drawdownGate) {
      lines.push(
        `- Drawdown gate (≤ ${book.drawdownGate.maxDrawdownPct}%): P(exceed) **${pct(book.drawdownGate.probDrawdownGtThresholdPct)}** — ${book.drawdownGate.passed ? "**pass**" : "**review**"}`
      );
    }
    if (book.greeksExposure.length > 0) {
      const top = book.greeksExposure.slice(0, 4);
      lines.push(
        "- **Greeks rollup (top):**",
        ...top.map(
          (g) =>
            `  - ${g.symbol}: Δ notional $${Math.round(g.deltaNotionalUsd).toLocaleString()} · Θ/day $${Math.round(g.thetaDailyUsd).toLocaleString()}`
        )
      );
    }
    lines.push("");
  }

  if (result.combinedTailRisk) {
    const c = result.combinedTailRisk;
    lines.push(
      "#### Combined book (weighted)",
      `- **1D VaR** ${pct(c.var1dPct95)} · **CVaR** ${pct(c.cvar1dPct95)} · **P(DD>20%)** ${pct(c.probDrawdownGt20Pct * 100)}`,
      `- ${c.advisorSummaryLine || c.riskTierNote}`,
      ""
    );
  }

  lines.push(
    result.disclaimer,
    "",
    `_Strategy job handoff: [xOptions Hardcore jobs](${result.strategyJobHandoff.path}) — ${result.strategyJobHandoff.instruction}_`
  );

  return lines.join("\n");
}
