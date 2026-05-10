/**
 * Book-level Monte Carlo tail risk (Student-t shocks + Poisson jumps), aligned with
 * `MonteCarloTailRiskEngine` on the JVM. Workspace/xChat uses a bounded path count;
 * Redis caches summarized JSON for 5 minutes (`xf:tailrisk:v1:*`).
 */
import { createHash } from "crypto";

import { getRedisClientForPlane } from "@/lib/redis-client";

export type McRiskTolerance = "conservative" | "moderate" | "aggressive";

export type TailRiskStressSliceJson = {
  label: string;
  var1dPct: number;
  var10dPct: number;
  cvar1dPct: number;
  probDrawdownGt20Pct: number;
};

export type BookTailRiskSummaryJson = {
  paths: number;
  var1dPct95: number;
  var10dPct95: number;
  cvar1dPct95: number;
  cvar10dPct95: number;
  probDrawdownGt20Pct: number;
  stress2020VolSpike: TailRiskStressSliceJson;
  stressCorrelationCrush: TailRiskStressSliceJson;
  riskTierNote: string;
  hedgeOverlayHint: string;
  /** Short line for prompts / rationale concatenation. */
  advisorSummaryLine: string;
};

export type OptionContractMcSnapshot = {
  strike: number;
  impliedVol: number;
  openInterest: number;
  volume: number;
  bid: number;
  ask: number;
  delta: number;
  isCall: boolean;
};

export type OptionChainMcSnapshot = {
  underlying: string;
  expirationYmd: string;
  spot: number;
  calls: OptionContractMcSnapshot[];
  puts: OptionContractMcSnapshot[];
};

export type PortfolioHoldingMcSnapshot = {
  symbol: string;
  weight: number;
};

const TRADING_DAYS = 252;
const NU = 6;
const RHO_BASE = 0.35;
const RHO_CRUSH = 0.85;
const VOL_SPIKE = 2.5;
const LAMBDA_JUMPS_ANNUAL = 1.5;
const JUMP_MEAN_LOG = -0.03;
const JUMP_SIGMA_LOG = 0.06;
const DEFAULT_SIGMA = 0.45;
const HORIZON_10 = 10;
const DD_THRESHOLD = 0.2;
const STRESS_PATH_CAP = 12_000;
export const TAIL_RISK_REDIS_PREFIX = "xf:tailrisk:v1:";
export const TAIL_RISK_CACHE_TTL_SECONDS = 300;

const CVAR_CAP: Record<McRiskTolerance, number> = {
  conservative: 0.08,
  moderate: 0.12,
  aggressive: 0.18
};

export function mapWatchlistRiskProfileToMcTier(
  riskProfile: string | null | undefined
): McRiskTolerance {
  const r = (riskProfile ?? "").toLowerCase();
  if (r === "conservative") return "conservative";
  if (r === "growth") return "aggressive";
  return "moderate";
}

function atmImpliedVolDecimal(chain: OptionChainMcSnapshot): number {
  if (chain.calls.length === 0 && chain.puts.length === 0) {
    return DEFAULT_SIGMA;
  }
  const atmC =
    chain.calls.length > 0
      ? chain.calls.reduce((a, b) => (Math.abs(b.strike - chain.spot) < Math.abs(a.strike - chain.spot) ? b : a))
      : null;
  const atmP =
    chain.puts.length > 0
      ? chain.puts.reduce((a, b) => (Math.abs(b.strike - chain.spot) < Math.abs(a.strike - chain.spot) ? b : a))
      : null;
  const vals = [atmC?.impliedVol, atmP?.impliedVol].filter(
    (v): v is number => typeof v === "number" && v > 0.01
  );
  if (vals.length === 0) return DEFAULT_SIGMA;
  return vals.reduce((s, x) => s + x, 0) / vals.length;
}

function normalizeHoldings(raw: PortfolioHoldingMcSnapshot[]): PortfolioHoldingMcSnapshot[] {
  const cleaned = raw
    .map((h) => ({ symbol: h.symbol.trim().toUpperCase(), weight: Math.max(0, h.weight) }))
    .filter((h) => h.symbol.length > 0 && h.weight > 0);
  const sum = cleaned.reduce((s, h) => s + h.weight, 0);
  if (sum <= 1e-12) return [];
  return cleaned.map((h) => ({ symbol: h.symbol, weight: h.weight / sum }));
}

function gaussian(rand: () => number): number {
  for (let k = 0; k < 12; k++) {
    const u1 = Math.max(rand(), 1e-12);
    const u2 = rand();
    const r = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    if (Number.isFinite(r)) return r;
  }
  return 0;
}

function studentT(rand: () => number, nu: number): number {
  const z = gaussian(rand);
  let chi = 0;
  for (let i = 0; i < nu; i++) {
    const g = gaussian(rand);
    chi += g * g;
  }
  return z / Math.sqrt(chi / nu);
}

function studentTStd(rand: () => number, nu: number): number {
  const t = studentT(rand, nu);
  const scale = Math.sqrt(nu / (nu - 2));
  return t / scale;
}

function lossPctFromQuantile(q05: number): number {
  return Math.max(0, -q05 * 100);
}

function cvarFromSorted(sortedAsc: Float64Array, q05: number): number {
  let s = 0;
  let c = 0;
  for (let i = 0; i < sortedAsc.length; i++) {
    const x = sortedAsc[i]!;
    if (x <= q05) {
      s += x;
      c++;
    }
  }
  if (c === 0) return lossPctFromQuantile(q05);
  return Math.max(0, -(s / c) * 100);
}

function percentile(sortedAsc: Float64Array, p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.floor((sortedAsc.length - 1) * p)));
  return sortedAsc[idx]!;
}

function riskTierGuidance(tier: McRiskTolerance, cvar1dPct: number): { note: string; hedge: string } {
  const cap = CVAR_CAP[tier];
  const capPct = cap * 100;
  const breach = cvar1dPct / 100 > cap;
  const note = breach
    ? `Tail CVaR exceeds ${tier} budget (~${capPct.toFixed(0)}% 1D CVaR cap) — trim concentration or add hedges.`
    : `Tail CVaR is within your ${tier} budget (~${capPct.toFixed(0)}% 1D CVaR cap).`;
  const hedge =
    tier === "conservative"
      ? "Overlay bias: protective puts / collars on top weights; tighten income strikes only after tail sleeve is sized."
      : tier === "moderate"
        ? "Overlay bias: put spreads or lightweight index hedge vs largest single-name gaps."
        : "Overlay bias: ratio spreads or convex sleeve if single-name beta stacks (e.g. high-beta miners / mega-cap tech).";
  return { note, hedge };
}

function advisorSummaryLine(summary: BookTailRiskSummaryJson, tier: McRiskTolerance): string {
  const cap = tier === "conservative" ? 8 : tier === "moderate" ? 12 : 18;
  return (
    `Book tail-risk (MC ${summary.paths} paths, fat-tail+jumps): 1D VaR95≈${summary.var1dPct95.toFixed(2)}%, ` +
    `10D VaR95≈${summary.var10dPct95.toFixed(2)}%, 1D CVaR95≈${summary.cvar1dPct95.toFixed(2)}%, ` +
    `P(10d DD>20%)≈${(summary.probDrawdownGt20Pct * 100).toFixed(1)}%. ` +
    `${summary.riskTierNote} (${cap}% CVaR guardrail). ${summary.hedgeOverlayHint}`
  );
}

type ScenarioStats = {
  var1dPct95: number;
  var10dPct95: number;
  cvar1dPct95: number;
  cvar10dPct95: number;
  probDrawdownGt20Pct: number;
};

function runScenario(
  weights: number[],
  sigmaAnnual: number[],
  rho: number,
  volMultiplier: number,
  paths: number,
  rand: () => number
): ScenarioStats {
  const n = weights.length;
  const sigma = sigmaAnnual.map((s) => s * volMultiplier);
  const rhoC = Math.min(0.99, Math.max(0, rho));
  const sqrtRho = Math.sqrt(rhoC);
  const sqrtOne = Math.sqrt(1 - rhoC);
  const dt = 1 / TRADING_DAYS;
  const sqrtDt = Math.sqrt(dt);
  const lambdaDt = LAMBDA_JUMPS_ANNUAL / TRADING_DAYS;

  const ret1d = new Float64Array(paths);
  const ret10d = new Float64Array(paths);
  const dd10 = new Float64Array(paths);

  const oneStep = (): number => {
    const f = studentTStd(rand, NU);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const eps = studentTStd(rand, NU);
      const z = sqrtRho * f + sqrtOne * eps;
      let r = sigma[i]! * sqrtDt * z;
      if (rand() < lambdaDt) {
        r += Math.exp(JUMP_MEAN_LOG + JUMP_SIGMA_LOG * gaussian(rand)) - 1;
      }
      sum += weights[i]! * r;
    }
    return sum;
  };

  for (let p = 0; p < paths; p++) {
    ret1d[p] = oneStep();
    let wealth = 1;
    let peak = 1;
    let maxDd = 0;
    for (let d = 0; d < HORIZON_10; d++) {
      const r = oneStep();
      wealth *= 1 + r;
      peak = Math.max(peak, wealth);
      maxDd = Math.max(maxDd, (peak - wealth) / Math.max(peak, 1e-12));
    }
    ret10d[p] = wealth - 1;
    dd10[p] = maxDd;
  }

  ret1d.sort();
  ret10d.sort();
  const q05_1 = percentile(ret1d, 0.05);
  const q05_10 = percentile(ret10d, 0.05);
  let ddBreaches = 0;
  for (let i = 0; i < paths; i++) {
    if (dd10[i]! > DD_THRESHOLD) ddBreaches++;
  }

  return {
    var1dPct95: lossPctFromQuantile(q05_1),
    var10dPct95: lossPctFromQuantile(q05_10),
    cvar1dPct95: cvarFromSorted(ret1d, q05_1),
    cvar10dPct95: cvarFromSorted(ret10d, q05_10),
    probDrawdownGt20Pct: ddBreaches / paths
  };
}

export function buildTailRiskRedisCacheKey(
  tier: McRiskTolerance,
  holdings: PortfolioHoldingMcSnapshot[],
  chains: Record<string, OptionChainMcSnapshot>,
  paths: number
): string {
  const norm = normalizeHoldings(holdings);
  const payload = [
    tier,
    String(paths),
    ...norm.map((h) => `${h.symbol}:${h.weight.toFixed(6)}`),
    ...Object.keys(chains)
      .sort()
      .map((sym) => {
        const c = chains[sym];
        if (!c) return "";
        return `${sym}@${c.expirationYmd}@${c.spot.toFixed(4)}@${atmImpliedVolDecimal(c).toFixed(4)}`;
      })
  ].join("|");
  const hex = createHash("sha256").update(payload).digest("hex");
  return `${TAIL_RISK_REDIS_PREFIX}${hex}`;
}

export async function tryReadTailRiskCache(key: string): Promise<BookTailRiskSummaryJson | null> {
  const redis = await getRedisClientForPlane("cache");
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as BookTailRiskSummaryJson;
  } catch {
    return null;
  }
}

export async function tryWriteTailRiskCache(key: string, summary: BookTailRiskSummaryJson): Promise<void> {
  const redis = await getRedisClientForPlane("cache");
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(summary), { EX: TAIL_RISK_CACHE_TTL_SECONDS });
  } catch {
    /* ignore */
  }
}

/**
 * Monte Carlo tail-risk snapshot for equity weights + optional per-symbol option chains (ATM IV).
 */
export async function computeBookTailRiskMonteCarlo(input: {
  tier: McRiskTolerance;
  holdings: PortfolioHoldingMcSnapshot[];
  chainsByTicker: Record<string, OptionChainMcSnapshot>;
  pathCount?: number;
  rand?: () => number;
  skipRedis?: boolean;
}): Promise<BookTailRiskSummaryJson | null> {
  const norm = normalizeHoldings(input.holdings);
  if (norm.length === 0) return null;

  const paths = Math.min(50_000, Math.max(5_000, Math.floor(input.pathCount ?? 12_000)));
  const rand = input.rand ?? Math.random;

  const cacheKey = buildTailRiskRedisCacheKey(input.tier, norm, input.chainsByTicker, paths);
  if (!input.skipRedis) {
    const hit = await tryReadTailRiskCache(cacheKey);
    if (hit) return hit;
  }

  const weights = norm.map((h) => h.weight);
  const sigmaAnnual = norm.map((h) => {
    const ch = input.chainsByTicker[h.symbol];
    if (!ch) return DEFAULT_SIGMA;
    return Math.min(2.5, Math.max(0.05, atmImpliedVolDecimal(ch)));
  });

  const base = runScenario(weights, sigmaAnnual, RHO_BASE, 1, paths, rand);
  const stressVol = runScenario(weights, sigmaAnnual, RHO_BASE, VOL_SPIKE, Math.min(paths, STRESS_PATH_CAP), rand);
  const stressRho = runScenario(
    weights,
    sigmaAnnual,
    RHO_CRUSH,
    1,
    Math.min(paths, STRESS_PATH_CAP),
    rand
  );

  const { note, hedge } = riskTierGuidance(input.tier, base.cvar1dPct95);
  const summary: BookTailRiskSummaryJson = {
    paths,
    var1dPct95: base.var1dPct95,
    var10dPct95: base.var10dPct95,
    cvar1dPct95: base.cvar1dPct95,
    cvar10dPct95: base.cvar10dPct95,
    probDrawdownGt20Pct: base.probDrawdownGt20Pct,
    stress2020VolSpike: {
      label: "2020_style_vol_spike",
      var1dPct: stressVol.var1dPct95,
      var10dPct: stressVol.var10dPct95,
      cvar1dPct: stressVol.cvar1dPct95,
      probDrawdownGt20Pct: stressVol.probDrawdownGt20Pct
    },
    stressCorrelationCrush: {
      label: "correlation_crush",
      var1dPct: stressRho.var1dPct95,
      var10dPct: stressRho.var10dPct95,
      cvar1dPct: stressRho.cvar1dPct95,
      probDrawdownGt20Pct: stressRho.probDrawdownGt20Pct
    },
    riskTierNote: note,
    hedgeOverlayHint: hedge,
    advisorSummaryLine: ""
  };
  summary.advisorSummaryLine = advisorSummaryLine(summary, input.tier);

  if (!input.skipRedis) {
    void tryWriteTailRiskCache(cacheKey, summary);
  }
  return summary;
}

export function isEquitySymbolForTailRisk(symbol: string): boolean {
  const s = symbol.trim();
  if (!s) return false;
  if (/^O:/i.test(s)) return false;
  if (/\s/.test(s)) return false;
  return true;
}
