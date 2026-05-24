import { getAtxfinanceBackendOrigin } from "@/lib/env";
import { runStrategyRecommendationsTool } from "@/modules/xchat/strategy-recommendations-tool";

import type { SessionUser } from "@/lib/auth";

import type { HotPickCard, HotPicksPayload, HotPicksQueryInput } from "./hot-picks-types";

type StrategyLeg = {
  side?: string;
  right?: string;
  strike?: number;
  expiryYmd?: string;
  quantity?: number;
};

type StrategyRecRow = {
  strategy?: string;
  underlying?: string;
  expirationYmd?: string;
  score?: number;
  legs?: StrategyLeg[];
  riskReward?: {
    maxProfit?: number;
    maxLoss?: number;
    breakeven?: number;
    popApproxPercent?: number;
  };
  rationale?: string;
};

function outlookForBias(bias: HotPicksQueryInput["bias"]): "bullish" | "bearish" | "neutral" {
  if (bias === "aggressive") {
    return "neutral";
  }
  return "bullish";
}

function biasToRisk(bias: HotPicksQueryInput["bias"]): "conservative" | "moderate" | "aggressive" {
  if (bias === "conservative") {
    return "conservative";
  }
  if (bias === "aggressive") {
    return "aggressive";
  }
  return "moderate";
}

function preferredForBias(bias: HotPicksQueryInput["bias"]): string[] | undefined {
  const income = ["covered_call", "cash_secured_put", "bull_put_spread", "bear_call_spread"];
  if (bias === "conservative") {
    return income;
  }
  if (bias === "balanced") {
    return [...income, "wheel_protective_collar"];
  }
  return [...income, "iron_condor"];
}

function strategyLabel(slug: string): string {
  return slug.replaceAll("_", " ");
}

function contractLabel(row: StrategyRecRow, leg: StrategyLeg | undefined): string {
  const sym = row.underlying ?? "—";
  const exp = row.expirationYmd?.slice(5).replace("-", "/") ?? "";
  const strike = leg?.strike != null ? Math.round(leg.strike) : "";
  const side = leg?.right === "put" ? "P" : "C";
  return `${sym} ${exp} ${strike}${side}`.trim();
}

function outlookForStrategy(slug: string): string {
  if (slug.includes("put") && !slug.includes("bull")) {
    return "bullish";
  }
  if (slug.includes("bear") || slug === "protective_put" || slug === "long_put") {
    return "bearish";
  }
  if (slug === "iron_condor" || slug === "long_straddle") {
    return "neutral";
  }
  return "neutral";
}

function mapRecommendationToCard(row: StrategyRecRow): HotPickCard | null {
  const underlying = row.underlying?.trim().toUpperCase();
  const strategy = row.strategy?.trim().toLowerCase();
  const score = row.score;
  if (!underlying || !strategy || score == null || !Number.isFinite(score)) {
    return null;
  }
  const leg = row.legs?.[0];
  const rr = row.riskReward;
  const maxLoss = rr?.maxLoss ?? 0;
  const maxProfit = rr?.maxProfit ?? 0;
  const maxGainPct = maxLoss > 0 ? (maxProfit / maxLoss) * 100 : 0;
  const maxLossPct = maxProfit > 0 ? (-maxLoss / maxProfit) * 100 : -100;
  const estRoiPct = maxLoss > 0 ? (maxProfit / maxLoss) * 100 : 0;

  return {
    id: `${underlying}:${row.expirationYmd ?? ""}:${strategy}:${leg?.strike ?? 0}`,
    symbol: underlying,
    expirationYmd: row.expirationYmd ?? "",
    strategy,
    strategyLabel: strategyLabel(strategy),
    contractLabel: contractLabel(row, leg),
    outlook: outlookForStrategy(strategy),
    edgeScore: score,
    entry: 0,
    breakeven: rr?.breakeven ?? 0,
    popPercent: rr?.popApproxPercent ?? 50,
    estRoiPercent: estRoiPct,
    ivRankPercent: 0,
    maxGainPercent: maxGainPct,
    maxLossPercent: maxLossPct,
    rationale: row.rationale ?? "",
    legs: (row.legs ?? []).map((l) => ({
      side: l.side ?? "",
      right: l.right ?? "",
      strike: l.strike ?? 0,
      expiryYmd: l.expiryYmd ?? row.expirationYmd ?? "",
      quantity: l.quantity ?? 1
    }))
  };
}

function passesFilters(
  row: StrategyRecRow,
  query: HotPicksQueryInput,
  edgeFloor: number
): boolean {
  const score = row.score ?? 0;
  if (score < edgeFloor || score > query.maxEdgeScore) {
    return false;
  }
  const pop = row.riskReward?.popApproxPercent ?? 0;
  const strategy = row.strategy ?? "";
  const income = new Set([
    "covered_call",
    "cash_secured_put",
    "bull_put_spread",
    "bear_call_spread"
  ]);
  if (query.bias === "conservative") {
    if (!income.has(strategy)) {
      return false;
    }
    if (pop < 55) {
      return false;
    }
  }
  const naked = new Set(["long_call", "long_put", "long_straddle"]);
  if (naked.has(strategy) && query.bias !== "aggressive") {
    return false;
  }
  return true;
}

/**
 * Uses existing {@link runStrategyRecommendationsTool} / JVM OptionsStrategyEngine when
 * `/api/portfolios/hot-picks` is missing or still returns legacy 503.
 */
export async function runHotPicksScanNextEngine(
  session: SessionUser,
  query: HotPicksQueryInput,
  sessionCookie: string,
  symbols: string[]
): Promise<HotPicksPayload> {
  const cachedAt = new Date().toISOString();
  const horizonDays = Math.round((query.dteMin + query.dteMax) / 2);

  if (symbols.length === 0) {
    return {
      picks: [],
      meta: {
        scope: query.scope,
        bias: query.bias,
        portfolioId: query.portfolioId,
        minEdgeScore: query.minEdgeScore,
        maxEdgeScore: query.maxEdgeScore,
        dteMin: query.dteMin,
        dteMax: query.dteMax,
        symbolCount: 0,
        symbols: [],
        cachedAt,
        cacheTtlSeconds: 3600,
        cacheHit: false,
        statusNote:
          query.scope === "watchlist"
            ? "Your watchlist has no symbols yet. Add tickers on the Watchlist desk or try All market."
            : "No symbols in scope for this scan."
      }
    };
  }

  if (!getAtxfinanceBackendOrigin()) {
    return {
      picks: [],
      meta: {
        scope: query.scope,
        bias: query.bias,
        portfolioId: query.portfolioId,
        minEdgeScore: query.minEdgeScore,
        maxEdgeScore: query.maxEdgeScore,
        dteMin: query.dteMin,
        dteMax: query.dteMax,
        symbolCount: symbols.length,
        symbols,
        cachedAt,
        cacheTtlSeconds: 3600,
        cacheHit: false,
        statusNote:
          "Set ATXFINANCE_BACKEND_ORIGIN (e.g. http://127.0.0.1:8080) and restart Spring for engine-backed Hot Picks."
      }
    };
  }

  const picks: HotPickCard[] = [];
  let batchesOk = 0;
  let usedSyntheticChains = false;
  let lastEngineError: string | null = null;
  const allowSyntheticFallback =
    process.env.ATX_DEPLOY_TARGET?.trim().toLowerCase() === "dev" &&
    process.env.NODE_ENV !== "production";

  for (let i = 0; i < symbols.length && picks.length < 24; i += 5) {
    const batch = symbols.slice(i, i + 5);
    const raw = await runStrategyRecommendationsTool(
      {
        symbols: batch,
        outlook: outlookForBias(query.bias),
        risk: biasToRisk(query.bias),
        horizonDays,
        maxResults: 8,
        minScore: query.minEdgeScore,
        preferredStrategies: preferredForBias(query.bias),
        ...(allowSyntheticFallback ? { allowSyntheticFallback: true } : {}),
        ...(query.portfolioId ? { portfolioId: query.portfolioId } : {})
      },
      { sessionCookie }
    );

    if (raw && typeof raw === "object" && "error" in (raw as Record<string, unknown>)) {
      const err = raw as { message?: string; error?: string };
      lastEngineError =
        typeof err.message === "string"
          ? err.message
          : typeof err.error === "string"
            ? err.error
            : lastEngineError;
      continue;
    }

    const data = (raw as { data?: { recommendations?: StrategyRecRow[]; source?: string } })?.data;
    const recs = data?.recommendations ?? [];
    if (data?.source === "synthetic") {
      usedSyntheticChains = true;
    }
    const edgeFloor =
      data?.source === "synthetic"
        ? Math.min(query.minEdgeScore, 50)
        : query.minEdgeScore;
    if (recs.length > 0) {
      batchesOk += 1;
    }
    for (const rec of recs) {
      if (!passesFilters(rec, query, edgeFloor)) {
        continue;
      }
      const card = mapRecommendationToCard(rec);
      if (card) {
        picks.push(card);
      }
    }
  }

  picks.sort((a, b) => b.edgeScore - a.edgeScore);

  return {
    picks: picks.slice(0, 24),
    meta: {
      scope: query.scope,
      bias: query.bias,
      portfolioId: query.portfolioId,
      minEdgeScore: query.minEdgeScore,
      maxEdgeScore: query.maxEdgeScore,
      dteMin: query.dteMin,
      dteMax: query.dteMax,
      symbolCount: symbols.length,
      symbols,
      chainsAttempted: symbols.length,
      chainsLoaded: batchesOk,
      cachedAt,
      cacheTtlSeconds: 3600,
      cacheHit: false,
      statusNote:
        picks.length === 0
          ? batchesOk === 0
            ? lastEngineError
              ? `Strategy engine: ${lastEngineError}`
              : "Strategy engine unavailable or returned no chains. Confirm Spring is running on ATXFINANCE_BACKEND_ORIGIN (restart after code changes)."
            : usedSyntheticChains
              ? `Scanned ${symbols.length} symbol(s) on local synthetic chains; none met edge ${Math.min(query.minEdgeScore, 50)}+ and ${query.bias} filters. Lower the slider to 50 or try Aggressive bias.`
              : `Scanned ${symbols.length} symbol(s); none met edge ${query.minEdgeScore}+ and ${query.bias} filters. Lower the edge slider or try All market.`
          : usedSyntheticChains
            ? `Engine scan (${batchesOk} batch(es)) using local synthetic chains — live Yahoo was unavailable. Not live market data.`
            : `Engine scan via strategy recommendations (${batchesOk} batch(es)).`
    }
  };
}
