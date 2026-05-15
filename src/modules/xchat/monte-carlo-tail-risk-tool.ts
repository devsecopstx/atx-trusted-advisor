import { europeanOptionGreeks } from "@/lib/xoptions/xoptions-bs-greeks";
import {
    getPortfolioByIdForSessionUser,
    listPortfolioAccounts,
    listPortfolioPositionsByAccount,
    listPortfoliosForSessionUser
} from "@/modules/core-admin/repository";
import type { Portfolio, Position } from "@/modules/core-admin/types";
import { normalizePositionType } from "@/modules/core-admin/types";
import {
    computeBookTailRiskMonteCarlo,
    isEquitySymbolForTailRisk,
    mapWatchlistRiskProfileToMcTier,
    type BookTailRiskSummaryJson,
    type McRiskTolerance,
    type OptionChainMcSnapshot,
    type OptionContractMcSnapshot,
    type PortfolioHoldingMcSnapshot
} from "@/modules/strategy-options/monte-carlo-tail-risk";
import { fetchYahooOptionChainForExpiration } from "@/modules/strategy-options/options-chain";
import { getYahooMarketQuote } from "@/modules/xchat/market-data";
import { getYahooFinance2 } from "@/modules/yahoo/yahoo-finance-service";
import { yahooQuoteWithValidationFallback } from "@/modules/yahoo/yahoo-quote-validation-fallback";

const PORTFOLIO_ID_PATTERN = /^[a-fA-F0-9]{24}$/;
const MAX_PORTFOLIOS = 5;
const OPTION_MULTIPLIER = 100;
const RISK_FREE_RATE = 0.045;

export type MonteCarloTailRiskToolContext = {
  userId: string;
  tenantId?: string;
  workspacePortfolioId?: string | null;
};

export type MonteCarloTailRiskToolRequest = {
  risk: McRiskTolerance;
  portfolioIds: string[];
  horizonDays: number;
  minIvRankPct?: number;
  maxDrawdownPct?: number;
  pathCount?: number;
  /** When true (default for `portfolioScope: all`), map each book's MC tier from account risk profile. */
  perPortfolioRisk?: boolean;
};

export type GreeksExposureRow = {
  symbol: string;
  deltaNotionalUsd: number;
  gammaNotionalUsd: number;
  thetaDailyUsd: number;
  vegaPerIvPtUsd: number;
  contracts: number;
  side: "long" | "short";
};

export type PortfolioMonteCarloResult = {
  portfolioId: string;
  portfolioName: string;
  holdingsCount: number;
  tailRisk: BookTailRiskSummaryJson | null;
  greeksExposure: GreeksExposureRow[];
  filteredSymbols?: string[];
  drawdownGate?: {
    maxDrawdownPct: number;
    probDrawdownGtThresholdPct: number;
    passed: boolean;
  };
};

export type MonteCarloTailRiskToolError = {
  ok: false;
  error: "invalid_monte_carlo_context" | "no_equity_book" | "portfolio_not_found";
  message: string;
  details?: unknown;
};

export type MonteCarloTailRiskToolSuccess = {
  ok: true;
  generatedAt: string;
  risk: McRiskTolerance;
  horizonDays: number;
  minIvRankPct: number | null;
  portfolios: PortfolioMonteCarloResult[];
  combinedTailRisk: BookTailRiskSummaryJson | null;
  strategyJobHandoff: {
    path: string;
    instruction: string;
  };
  disclaimer: string;
};

export type MonteCarloTailRiskToolResult = MonteCarloTailRiskToolSuccess | MonteCarloTailRiskToolError;

export type MonteCarloTailRiskParseResult =
  | { ok: true; request: MonteCarloTailRiskToolRequest }
  | MonteCarloTailRiskToolError;

export function parseMonteCarloTailRiskToolArgs(
  args: Record<string, unknown>,
  ctx: Pick<MonteCarloTailRiskToolContext, "workspacePortfolioId"> = {}
): MonteCarloTailRiskParseResult {
  const scopeRaw = typeof args.portfolioScope === "string" ? args.portfolioScope.trim().toLowerCase() : "";
  const scopeAll = scopeRaw === "all" || scopeRaw === "workspace_all";
  const perPortfolioRisk =
    args.perPortfolioRisk === true || (scopeAll && args.perPortfolioRisk !== false);
  const risk =
    normalizeRisk(args.risk ?? args.riskTolerance) ?? (perPortfolioRisk ? "moderate" : null);
  if (!risk) {
    return {
      ok: false,
      error: "invalid_monte_carlo_context",
      message: "monte_carlo_tail_risk requires risk: conservative | moderate | aggressive."
    };
  }

  const horizonDays = normalizeInteger(args.horizonDays ?? args.daysToExpiration ?? args.dte) ?? 45;
  if (horizonDays < 1 || horizonDays > 365) {
    return {
      ok: false,
      error: "invalid_monte_carlo_context",
      message: "horizonDays must be between 1 and 365."
    };
  }

  const portfolioIds = normalizePortfolioIds(args, ctx.workspacePortfolioId);
  const minIvRankPct = normalizePercent(args.minIvRankPct ?? args.ivRankMin);
  const maxDrawdownPct = normalizePercent(args.maxDrawdownPct ?? args.maxDrawdown);
  const pathCount = normalizeInteger(args.pathCount ?? args.paths);

  return {
    ok: true,
    request: {
      risk,
      portfolioIds,
      horizonDays,
      ...(minIvRankPct != null ? { minIvRankPct } : {}),
      ...(maxDrawdownPct != null ? { maxDrawdownPct } : {}),
      ...(pathCount != null ? { pathCount } : {}),
      ...(perPortfolioRisk ? { perPortfolioRisk: true } : {})
    }
  };
}

export async function runMonteCarloTailRiskTool(
  args: Record<string, unknown>,
  ctx: MonteCarloTailRiskToolContext
): Promise<MonteCarloTailRiskToolResult> {
  const parsed = parseMonteCarloTailRiskToolArgs(args, ctx);
  if (!parsed.ok) {
    return parsed;
  }
  const request = parsed.request;

  const portfolios = await resolveOwnedPortfolios(ctx, request.portfolioIds);
  if (portfolios.length === 0) {
    return {
      ok: false,
      error: "portfolio_not_found",
      message: "No matching portfolios found for this user."
    };
  }

  const portfolioResults: PortfolioMonteCarloResult[] = [];
  const combinedHoldings: PortfolioHoldingMcSnapshot[] = [];
  let combinedNotional = 0;

  for (const pf of portfolios) {
    if (!pf._id) {
      continue;
    }
    const portfolioId = pf._id.toHexString();
    const book = await loadEquityBook(ctx, portfolioId);
    if (book.holdings.length === 0) {
      portfolioResults.push({
        portfolioId,
        portfolioName: pf.name,
        holdingsCount: 0,
        tailRisk: null,
        greeksExposure: []
      });
      continue;
    }

    let holdings = book.holdings;
    const chainsByTicker: Record<string, OptionChainMcSnapshot> = {};
    const ivFiltered: string[] = [];

    for (const h of holdings) {
      const chain = await loadMcChainSnapshot(h.symbol, request.horizonDays);
      if (chain) {
        chainsByTicker[h.symbol] = chain;
        if (request.minIvRankPct != null) {
          const ivRank = estimateIvRankPercent(chain);
          if (ivRank != null && ivRank >= request.minIvRankPct) {
            ivFiltered.push(h.symbol);
          }
        }
      }
    }

    if (request.minIvRankPct != null) {
      const allowed = new Set(ivFiltered);
      holdings = holdings.filter((h) => allowed.has(h.symbol));
      if (holdings.length === 0) {
        portfolioResults.push({
          portfolioId,
          portfolioName: pf.name,
          holdingsCount: 0,
          tailRisk: null,
          greeksExposure: [],
          filteredSymbols: ivFiltered
        });
        continue;
      }
    }

    const bookTier =
      request.perPortfolioRisk && portfolios.length > 1
        ? await resolveMcTierForPortfolio(ctx, portfolioId, request.risk)
        : request.risk;

    const tailRisk = await computeBookTailRiskMonteCarlo({
      tier: bookTier,
      holdings,
      chainsByTicker,
      pathCount: request.pathCount
    });

    const greeksExposure = await buildGreeksExposureRollup(book.positions, chainsByTicker);

    let drawdownGate: PortfolioMonteCarloResult["drawdownGate"];
    if (tailRisk && request.maxDrawdownPct != null) {
      const threshold = request.maxDrawdownPct / 100;
      const prob = estimateProbDrawdownAbove(tailRisk, threshold);
      drawdownGate = {
        maxDrawdownPct: request.maxDrawdownPct,
        probDrawdownGtThresholdPct: prob * 100,
        passed: prob <= 0.5
      };
    }

    portfolioResults.push({
      portfolioId,
      portfolioName: pf.name,
      holdingsCount: holdings.length,
      tailRisk,
      greeksExposure,
      ...(request.minIvRankPct != null ? { filteredSymbols: holdings.map((h) => h.symbol) } : {}),
      ...(drawdownGate ? { drawdownGate } : {})
    });

    for (const h of holdings) {
      const notion = h.weight * book.totalNotional;
      combinedNotional += notion;
      combinedHoldings.push({ symbol: h.symbol, weight: notion });
    }
  }

  const normalizedCombined =
    combinedNotional > 0
      ? combinedHoldings.map((h) => ({ symbol: h.symbol, weight: h.weight / combinedNotional }))
      : [];

  const combinedTailRisk =
    normalizedCombined.length > 0
      ? await computeBookTailRiskMonteCarlo({
          tier: request.risk,
          holdings: normalizedCombined,
          chainsByTicker: {},
          pathCount: request.pathCount
        })
      : null;

  if (portfolioResults.every((p) => p.holdingsCount === 0 && !p.tailRisk)) {
    return {
      ok: false,
      error: "no_equity_book",
      message:
        "No equity holdings matched the requested portfolios and filters. Import holdings or relax IV rank / portfolio scope."
    };
  }

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    risk: request.risk,
    horizonDays: request.horizonDays,
    minIvRankPct: request.minIvRankPct ?? null,
    portfolios: portfolioResults,
    combinedTailRisk,
    strategyJobHandoff: {
      path: "/xoptions",
      instruction:
        'To save a formal multi-leg package, open xOptions → Hardcore strategy jobs or reply "launch strategy job" when the server offers preflight.'
    },
    disclaimer:
      "Monte Carlo tail metrics are illustrative simulations (Student-t + jumps), not forecasts. Educational quant desk only — not investment advice."
  };
}

function normalizeRisk(value: unknown): McRiskTolerance | null {
  if (typeof value !== "string") {
    return null;
  }
  const n = value.trim().toLowerCase().replaceAll("-", "_");
  if (n === "conservative") return "conservative";
  if (n === "moderate" || n === "balanced") return "moderate";
  if (n === "aggressive" || n === "growth") return "aggressive";
  return null;
}

function normalizeInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return null;
}

function normalizePercent(value: unknown): number | null {
  const n = normalizeInteger(value);
  if (n == null) {
    return null;
  }
  return Math.min(99, Math.max(1, n));
}

function normalizePortfolioIds(
  args: Record<string, unknown>,
  workspacePortfolioId?: string | null
): string[] {
  const fromArray = Array.isArray(args.portfolioIds)
    ? args.portfolioIds
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter((id) => PORTFOLIO_ID_PATTERN.test(id))
    : [];

  if (fromArray.length > 0) {
    return Array.from(new Set(fromArray)).slice(0, MAX_PORTFOLIOS);
  }

  const single =
    typeof args.portfolioId === "string" && PORTFOLIO_ID_PATTERN.test(args.portfolioId.trim())
      ? args.portfolioId.trim()
      : undefined;
  if (single) {
    return [single];
  }

  const scope = typeof args.portfolioScope === "string" ? args.portfolioScope.trim().toLowerCase() : "";
  if (scope === "all" || scope === "workspace_all") {
    return [];
  }

  const ws = workspacePortfolioId?.trim();
  if (ws && PORTFOLIO_ID_PATTERN.test(ws)) {
    return [ws];
  }

  return [];
}

async function resolveMcTierForPortfolio(
  ctx: MonteCarloTailRiskToolContext,
  portfolioId: string,
  fallback: McRiskTolerance
): Promise<McRiskTolerance> {
  const accounts = await listPortfolioAccounts({
    userId: ctx.userId,
    portfolioId,
    tenantId: ctx.tenantId
  });
  const ordered = [...accounts].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  const profile = ordered.find((a) => a.riskProfile != null)?.riskProfile;
  if (profile === "conservative") {
    return "conservative";
  }
  if (profile === "growth") {
    return "aggressive";
  }
  if (profile === "balanced") {
    return "moderate";
  }
  return fallback;
}

async function resolveOwnedPortfolios(
  ctx: MonteCarloTailRiskToolContext,
  portfolioIds: string[]
): Promise<Portfolio[]> {
  const all = await listPortfoliosForSessionUser({
    userId: ctx.userId,
    tenantId: ctx.tenantId
  });

  if (portfolioIds.length === 0) {
    return all.slice(0, MAX_PORTFOLIOS);
  }

  const out: Portfolio[] = [];
  for (const id of portfolioIds.slice(0, MAX_PORTFOLIOS)) {
    const pf = await getPortfolioByIdForSessionUser({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      portfolioId: id
    });
    if (pf) {
      out.push(pf);
    }
  }
  return out;
}

async function loadEquityBook(
  ctx: MonteCarloTailRiskToolContext,
  portfolioId: string
): Promise<{
  holdings: PortfolioHoldingMcSnapshot[];
  positions: Position[];
  totalNotional: number;
}> {
  const accounts = await listPortfolioAccounts({
    userId: ctx.userId,
    portfolioId,
    tenantId: ctx.tenantId
  });
  const accountIds = accounts
    .map((a) => a._id)
    .filter((id): id is NonNullable<(typeof accounts)[0]["_id"]> => Boolean(id));

  const positions =
    accountIds.length > 0
      ? await listPortfolioPositionsByAccount({
          userId: ctx.userId,
          portfolioId,
          accountIds,
          tenantId: ctx.tenantId
        })
      : [];

  const equityRows = positions.filter((p) => isEquitySymbolForTailRisk(p.symbol));
  const totalNotional = equityRows.reduce((sum, p) => sum + Math.abs(p.qty * p.avgCost), 0);
  if (totalNotional <= 1e-6) {
    return { holdings: [], positions, totalNotional: 0 };
  }

  const holdings = equityRows.map((p) => ({
    symbol: p.symbol.trim().toUpperCase(),
    weight: Math.abs(p.qty * p.avgCost) / totalNotional
  }));

  return { holdings, positions, totalNotional };
}

function normalizeExpirationDateToken(value: Date | string): string | null {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  return null;
}

function daysToExpirationUtc(expYmd: string): number {
  const exp = Date.parse(`${expYmd}T00:00:00.000Z`);
  const today = Date.now();
  return Math.max(1, Math.ceil((exp - today) / (1000 * 60 * 60 * 24)));
}

async function pickExpirationForHorizon(symbol: string, horizonDays: number): Promise<string | null> {
  const yahoo = getYahooFinance2();
  try {
    const optionsResult = (await yahoo.options(symbol)) as { expirationDates?: Array<Date | string> };
    const dates = (optionsResult.expirationDates ?? [])
      .map(normalizeExpirationDateToken)
      .filter((x): x is string => typeof x === "string");
    if (dates.length === 0) {
      return null;
    }
    const ranked = dates
      .map((exp) => {
        const dte = daysToExpirationUtc(exp);
        return { exp, dte, delta: Math.abs(dteDistance(dte, horizonDays)) };
      })
      .sort((a, b) => a.delta - b.delta);
    return ranked[0]?.exp ?? null;
  } catch {
    return null;
  }
}

function dteDistance(dte: number, target: number): number {
  return dte - target;
}

async function loadMcChainSnapshot(
  symbol: string,
  horizonDays: number
): Promise<OptionChainMcSnapshot | null> {
  const sym = symbol.trim().toUpperCase();
  const exp = await pickExpirationForHorizon(sym, horizonDays);
  if (!exp) {
    return null;
  }

  const quote = await getYahooMarketQuote({ symbol: sym }).catch(() => null);
  const spot =
    quote && typeof quote.price === "number" && Number.isFinite(quote.price) ? quote.price : null;
  if (spot == null || spot <= 0) {
    try {
      const yahoo = getYahooFinance2();
      const q = (await yahooQuoteWithValidationFallback(yahoo, sym, "mc-tail-risk")) as {
        regularMarketPrice?: number;
      };
      if (typeof q.regularMarketPrice === "number" && q.regularMarketPrice > 0) {
        return loadMcChainSnapshotWithSpot(sym, exp, q.regularMarketPrice, horizonDays);
      }
    } catch {
      return null;
    }
    return null;
  }

  return loadMcChainSnapshotWithSpot(sym, exp, spot, horizonDays);
}

async function loadMcChainSnapshotWithSpot(
  symbol: string,
  expiration: string,
  spot: number,
  horizonDays: number
): Promise<OptionChainMcSnapshot | null> {
  const dte = daysToExpirationUtc(expiration);
  const chain = await fetchYahooOptionChainForExpiration(symbol, expiration, spot, Math.max(1, dte));
  if (!chain?.optionChain?.length) {
    return null;
  }

  const calls: OptionContractMcSnapshot[] = [];
  const puts: OptionContractMcSnapshot[] = [];
  for (const row of chain.optionChain) {
    if (row.call) {
      calls.push(contractFromLeg(row.call, true));
    }
    if (row.put) {
      puts.push(contractFromLeg(row.put, false));
    }
  }

  return {
    underlying: symbol,
    expirationYmd: chain.actualExpiration,
    spot,
    calls,
    puts
  };
}

function contractFromLeg(
  leg: {
    strike_price: number;
    last_quote?: { bid?: number; ask?: number };
    volume?: number;
    open_interest?: number;
    implied_volatility?: number;
    greeks?: { delta?: number };
  },
  isCall: boolean
): OptionContractMcSnapshot {
  const bid = leg.last_quote?.bid ?? 0;
  const ask = leg.last_quote?.ask ?? 0;
  const ivRaw = leg.implied_volatility ?? 0;
  const iv = ivRaw > 3 ? ivRaw / 100 : ivRaw;
  return {
    strike: leg.strike_price,
    impliedVol: iv,
    openInterest: leg.open_interest ?? 0,
    volume: leg.volume ?? 0,
    bid,
    ask,
    delta: leg.greeks?.delta ?? (isCall ? 0.5 : -0.5),
    isCall
  };
}

function estimateIvRankPercent(chain: OptionChainMcSnapshot): number | null {
  const atm =
    chain.calls.length > 0
      ? chain.calls.reduce((a, b) =>
          Math.abs(b.strike - chain.spot) < Math.abs(a.strike - chain.spot) ? b : a
        )
      : chain.puts.length > 0
        ? chain.puts.reduce((a, b) =>
            Math.abs(b.strike - chain.spot) < Math.abs(a.strike - chain.spot) ? b : a
          )
        : null;
  if (!atm) {
    return null;
  }
  const ivPct = atm.impliedVol * 100;
  return Math.min(99, Math.max(1, ((ivPct - 15) / 55) * 100));
}

function estimateProbDrawdownAbove(summary: BookTailRiskSummaryJson, threshold: number): number {
  if (threshold <= 0.2) {
    return summary.probDrawdownGt20Pct;
  }
  const scale = threshold / 0.2;
  return Math.min(1, summary.probDrawdownGt20Pct * scale * 0.85);
}

async function buildGreeksExposureRollup(
  positions: Position[],
  chainsByTicker: Record<string, OptionChainMcSnapshot>
): Promise<GreeksExposureRow[]> {
  const bySymbol = new Map<string, GreeksExposureRow>();

  for (const pos of positions) {
    if (normalizePositionType(pos.type) !== "option") {
      continue;
    }
    if (!pos.optionType || pos.strike == null || !pos.expiration) {
      continue;
    }
    const underlying = pos.symbol.trim().toUpperCase();
    const chain = chainsByTicker[underlying];
    const spot = chain?.spot;
    if (spot == null || spot <= 0) {
      continue;
    }
    const exp =
      pos.expiration instanceof Date
        ? pos.expiration.toISOString().slice(0, 10)
        : String(pos.expiration).slice(0, 10);
    const dte = daysToExpirationUtc(exp);
    const T = dte / 365;
    const sigma =
      chain != null
        ? estimateIvRankPercent(chain) != null
          ? atmIvDecimal(chain)
          : 0.35
        : 0.35;

    const greeks = europeanOptionGreeks({
      spot,
      strike: pos.strike,
      T,
      sigma,
      riskFreeRate: RISK_FREE_RATE,
      side: pos.optionType
    });
    if (!greeks) {
      continue;
    }

    const contracts = Math.abs(pos.qty);
    const sign = pos.qty < 0 ? -1 : 1;
    const mult = OPTION_MULTIPLIER * contracts * sign;
    const row = bySymbol.get(underlying) ?? {
      symbol: underlying,
      deltaNotionalUsd: 0,
      gammaNotionalUsd: 0,
      thetaDailyUsd: 0,
      vegaPerIvPtUsd: 0,
      contracts: 0,
      side: sign < 0 ? "short" : "long"
    };
    row.deltaNotionalUsd += greeks.delta * spot * mult;
    row.gammaNotionalUsd += greeks.gamma * spot * mult;
    row.thetaDailyUsd += greeks.thetaPerDay * mult;
    row.vegaPerIvPtUsd += greeks.vegaPerOnePercentIv * mult;
    row.contracts += contracts;
    if (row.deltaNotionalUsd < 0) {
      row.side = "short";
    }
    bySymbol.set(underlying, row);
  }

  return [...bySymbol.values()].sort(
    (a, b) => Math.abs(b.deltaNotionalUsd) - Math.abs(a.deltaNotionalUsd)
  );
}

function atmIvDecimal(chain: OptionChainMcSnapshot): number {
  const atm =
    chain.calls.length > 0
      ? chain.calls.reduce((a, b) =>
          Math.abs(b.strike - chain.spot) < Math.abs(a.strike - chain.spot) ? b : a
        )
      : chain.puts[0];
  return Math.min(2.5, Math.max(0.05, atm?.impliedVol ?? 0.35));
}

/** Map account / watchlist risk labels to MC tier when args omit explicit risk. */
export function inferMcTierFromDeskProfile(
  riskProfile: string | null | undefined
): McRiskTolerance {
  return mapWatchlistRiskProfileToMcTier(riskProfile);
}
