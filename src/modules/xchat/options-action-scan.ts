import { ObjectId } from "mongodb";

import {
    getDefaultPortfolio,
    getUserWatchlist,
    listPortfolioAccounts,
    listPortfolioPositionsByAccount,
    provisionDefaultPortfolioForUser
} from "@/modules/core-admin/repository";
import type { SubscriptionPlan } from "@/modules/identity/types";
import { fetchYahooOptionChainForExpiration } from "@/modules/strategy-options/options-chain";
import { getYahooMarketQuote } from "@/modules/xchat/market-data";
import { getPlanLimits } from "@/modules/xchat/plan-limits";

const MAX_PRO_REPORT_ROWS = 20;
const MAX_BASIC_HOLDINGS_ROWS = 5;

export type OptionsAction = "ROLL" | "BTC" | "HOLD" | "LET_EXPIRE" | "STC" | "OPEN" | "MONITOR" | "WAIT";
export type OptionsActionUrgency = "high" | "med" | "low";
export type OptionsActionConfidence = "high" | "medium" | "low";
export type OptionsActionSource = "holding" | "watchlist";

export type OptionsActionReportRow = {
  source: OptionsActionSource;
  symbol: string;
  strike?: number;
  exp?: string;
  type?: "call" | "put";
  qty?: number;
  recommendedAction: OptionsAction;
  why: string;
  urgency: OptionsActionUrgency;
  targetWindow: string;
  confidence: OptionsActionConfidence;
};

export type OptionsActionReport = {
  planTier: SubscriptionPlan | "global_admin";
  truncated: boolean;
  rows: OptionsActionReportRow[];
  generatedAt: string;
  disclaimer: string;
  asMarkdown: string;
};

type BuildOptionsActionReportInput = {
  userId: string;
  tenantId?: string;
  subscriptionPlan?: SubscriptionPlan;
  includeWatchlist?: boolean;
};

type NormalizedOptionHolding = {
  symbol: string;
  optionType: "call" | "put";
  strike: number;
  expirationIsoDate: string;
  qty: number;
  avgCost: number;
};

type OptionMarketSnapshot = {
  spot: number | null;
  dte: number;
  deltaAbs: number | null;
  thetaPerDay: number | null;
  ivPct: number | null;
  mid: number | null;
  isInTheMoney: boolean | null;
};

const OPTIONS_SCAN_DISCLAIMER =
  "Not financial advice. This is for informational purposes only. Past performance does not guarantee future results.";

function daysToExpirationUtc(yyyyMmDd: string): number {
  const exp = new Date(`${yyyyMmDd}T00:00:00.000Z`);
  if (Number.isNaN(exp.getTime())) {
    return Number.POSITIVE_INFINITY;
  }
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const expUtc = Date.UTC(exp.getUTCFullYear(), exp.getUTCMonth(), exp.getUTCDate());
  return Math.max(0, Math.ceil((expUtc - todayUtc) / 86400000));
}

function normalizeOptionHolding(input: {
  symbol: unknown;
  optionType: unknown;
  strike: unknown;
  expiration: unknown;
  qty: unknown;
  avgCost: unknown;
}): NormalizedOptionHolding | null {
  if (typeof input.symbol !== "string" || input.symbol.trim().length === 0) {
    return null;
  }
  if (input.optionType !== "call" && input.optionType !== "put") {
    return null;
  }
  if (typeof input.strike !== "number" || !Number.isFinite(input.strike) || input.strike <= 0) {
    return null;
  }
  const exp = input.expiration;
  const expirationIsoDate =
    exp instanceof Date
      ? exp.toISOString().slice(0, 10)
      : typeof exp === "string"
        ? exp.slice(0, 10)
        : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expirationIsoDate)) {
    return null;
  }
  if (typeof input.qty !== "number" || !Number.isFinite(input.qty) || input.qty === 0) {
    return null;
  }
  if (typeof input.avgCost !== "number" || !Number.isFinite(input.avgCost) || input.avgCost < 0) {
    return null;
  }
  return {
    symbol: input.symbol.trim().toUpperCase(),
    optionType: input.optionType,
    strike: input.strike,
    expirationIsoDate,
    qty: input.qty,
    avgCost: input.avgCost
  };
}

function chooseHighestUrgency(rows: OptionsActionReportRow[]): OptionsActionReportRow[] {
  const urgencyRank: Record<OptionsActionUrgency, number> = {
    high: 3,
    med: 2,
    low: 1
  };
  return [...rows].sort((a, b) => {
    const ua = urgencyRank[a.urgency];
    const ub = urgencyRank[b.urgency];
    if (ua !== ub) {
      return ub - ua;
    }
    return a.symbol.localeCompare(b.symbol);
  });
}

async function getOrProvisionDefaultPortfolioId(
  userId: string,
  tenantId?: string
): Promise<string | null> {
  const existing = await getDefaultPortfolio(userId, { tenantId });
  if (existing?._id) {
    return existing._id.toHexString();
  }
  try {
    const created = await provisionDefaultPortfolioForUser({
      userId,
      tenantId,
      watchlistSymbols: ["TSLA"]
    });
    return created.portfolio._id?.toHexString() ?? null;
  } catch {
    return null;
  }
}

async function fetchHoldingMarketSnapshot(
  holding: NormalizedOptionHolding,
  quoteCache: Map<string, number | null>
): Promise<OptionMarketSnapshot> {
  if (!quoteCache.has(holding.symbol)) {
    const quote = await getYahooMarketQuote({ symbol: holding.symbol }).catch(() => null);
    quoteCache.set(
      holding.symbol,
      quote && typeof quote.price === "number" && Number.isFinite(quote.price) ? quote.price : null
    );
  }
  const spot = quoteCache.get(holding.symbol) ?? null;
  const dte = daysToExpirationUtc(holding.expirationIsoDate);
  if (dte === Number.POSITIVE_INFINITY) {
    return {
      spot,
      dte,
      deltaAbs: null,
      thetaPerDay: null,
      ivPct: null,
      mid: null,
      isInTheMoney: null
    };
  }

  const chain = await fetchYahooOptionChainForExpiration(
    holding.symbol,
    holding.expirationIsoDate,
    spot ?? holding.strike,
    Math.max(1, dte)
  ).catch(() => null);

  const matched = chain?.optionChain?.find((leg) => Math.abs(leg.strike - holding.strike) < 0.01);
  const contract = holding.optionType === "call" ? matched?.call : matched?.put;
  const bid = contract?.last_quote?.bid;
  const ask = contract?.last_quote?.ask;
  const mid =
    typeof bid === "number" &&
    Number.isFinite(bid) &&
    typeof ask === "number" &&
    Number.isFinite(ask)
      ? (bid + ask) / 2
      : null;
  const deltaRaw = contract?.greeks?.delta;
  const thetaPerDay = contract?.greeks?.theta_per_day;
  const deltaAbs =
    typeof deltaRaw === "number" && Number.isFinite(deltaRaw) ? Math.abs(deltaRaw) : null;
  const ivPct =
    typeof contract?.implied_volatility === "number" && Number.isFinite(contract.implied_volatility)
      ? contract.implied_volatility
      : null;
  const isInTheMoney =
    typeof spot === "number"
      ? holding.optionType === "call"
        ? spot >= holding.strike
        : spot <= holding.strike
      : null;

  return {
    spot,
    dte,
    deltaAbs,
    thetaPerDay: typeof thetaPerDay === "number" && Number.isFinite(thetaPerDay) ? thetaPerDay : null,
    ivPct,
    mid,
    isInTheMoney
  };
}

function deriveHoldingAction(
  holding: NormalizedOptionHolding,
  market: OptionMarketSnapshot
): Omit<OptionsActionReportRow, "source" | "symbol" | "strike" | "exp" | "type" | "qty"> {
  const isShort = holding.qty < 0;
  const dte = market.dte;
  const pnlPct =
    market.mid != null && holding.avgCost > 0
      ? isShort
        ? ((holding.avgCost - market.mid) / holding.avgCost) * 100
        : ((market.mid - holding.avgCost) / holding.avgCost) * 100
      : null;
  const targetWindow = dte <= 2 ? "today" : dte <= 7 ? "this week" : dte <= 21 ? "next 2-3 weeks" : "monitor monthly";

  const confidence: OptionsActionConfidence =
    market.deltaAbs != null && market.mid != null && market.spot != null
      ? "high"
      : market.spot != null
        ? "medium"
        : "low";

  if (isShort) {
    if (dte <= 3 && market.isInTheMoney === false && (market.mid ?? 1) <= 0.1) {
      return {
        recommendedAction: "LET_EXPIRE",
        why: "Short contract is near expiration and far from assignment risk; remaining premium is minimal.",
        urgency: "high",
        targetWindow,
        confidence
      };
    }
    if (dte <= 7 && (market.isInTheMoney === true || (market.deltaAbs ?? 0) >= 0.45)) {
      return {
        recommendedAction: "ROLL",
        why: "Assignment risk is elevated into expiration week; rolling can preserve risk limits and extend time.",
        urgency: "high",
        targetWindow,
        confidence
      };
    }
    if (dte <= 10 && pnlPct != null && pnlPct >= 70) {
      return {
        recommendedAction: "BTC",
        why: "Most premium has likely been captured; buying to close reduces tail risk before expiry.",
        urgency: "med",
        targetWindow,
        confidence
      };
    }
    return {
      recommendedAction: "HOLD",
      why: "Position is within normal management bounds for DTE and moneyness.",
      urgency: dte <= 10 ? "med" : "low",
      targetWindow,
      confidence
    };
  }

  if (dte <= 5 && market.isInTheMoney === false) {
    return {
      recommendedAction: "STC",
      why: "Long option is close to expiration and out-of-the-money; time decay risk is now dominant.",
      urgency: "high",
      targetWindow,
      confidence
    };
  }
  if (dte <= 10 && (market.thetaPerDay ?? 0) < -0.02) {
    return {
      recommendedAction: "STC",
      why: "Theta decay is accelerating into expiration; closing preserves remaining value.",
      urgency: "med",
      targetWindow,
      confidence
    };
  }
  if (dte <= 14 && market.isInTheMoney === true && pnlPct != null && pnlPct > 40) {
    return {
      recommendedAction: "STC",
      why: "Contract is in-the-money with gains and limited time left; realize value before rapid decay.",
      urgency: "med",
      targetWindow,
      confidence
    };
  }
  return {
    recommendedAction: "HOLD",
    why: "No immediate risk trigger from DTE, moneyness, or decay profile.",
    urgency: dte <= 14 ? "med" : "low",
    targetWindow,
    confidence
  };
}

function deriveWatchlistAction(input: {
  symbol: string;
  entryPrice?: number;
  spotPrice?: number;
}): Omit<OptionsActionReportRow, "source" | "symbol" | "strike" | "exp" | "type" | "qty"> {
  if (input.entryPrice != null && input.spotPrice != null) {
    if (input.spotPrice <= input.entryPrice * 1.02) {
      return {
        recommendedAction: "OPEN",
        why: "Spot is near your target entry zone; setup can be reviewed for execution.",
        urgency: "med",
        targetWindow: "this week",
        confidence: "medium"
      };
    }
    return {
      recommendedAction: "MONITOR",
      why: "Symbol is above your target entry zone; monitor for better risk/reward before opening.",
      urgency: "low",
      targetWindow: "next 2-3 weeks",
      confidence: "medium"
    };
  }
  if (input.spotPrice != null) {
    return {
      recommendedAction: "MONITOR",
      why: "Live price is available but target entry is not set; keep monitoring until setup criteria are defined.",
      urgency: "low",
      targetWindow: "monthly",
      confidence: "low"
    };
  }
  return {
    recommendedAction: "WAIT",
    why: "Insufficient setup data for a trade decision (no target entry or live spot context).",
    urgency: "low",
    targetWindow: "monthly",
    confidence: "low"
  };
}

export function renderOptionsActionReportMarkdown(input: {
  rows: OptionsActionReportRow[];
  isBasicTier: boolean;
  generatedAtIso: string;
}): string {
  const header = input.isBasicTier
    ? "| symbol | strike | exp | type | qty | action | target_window | confidence |\n|---|---:|---|---|---:|---|---|---|"
    : "| source | symbol | strike | exp | type | qty | action | why | urgency | target_window | confidence |\n|---|---|---:|---|---|---:|---|---|---|---|---|";
  const lines =
    input.rows.length === 0
      ? ["| - | - | - | - | - | HOLD | monitor | low |"]
      : input.rows.map((row) => {
          const strike = row.strike != null ? row.strike.toFixed(2) : "—";
          const exp = row.exp ?? "—";
          const type = row.type ?? "—";
          const qty = row.qty != null ? String(row.qty) : "—";
          if (input.isBasicTier) {
            return `| ${row.symbol} | ${strike} | ${exp} | ${type} | ${qty} | ${row.recommendedAction} | ${row.targetWindow} | ${row.confidence} |`;
          }
          return `| ${row.source} | ${row.symbol} | ${strike} | ${exp} | ${type} | ${qty} | ${row.recommendedAction} | ${row.why} | ${row.urgency} | ${row.targetWindow} | ${row.confidence} |`;
        });
  return [
    `### Options action scan (${new Date(input.generatedAtIso).toLocaleString("en-US", { timeZone: "UTC" })} UTC)`,
    "",
    header,
    ...lines,
    "",
    OPTIONS_SCAN_DISCLAIMER
  ].join("\n");
}

export async function buildOptionsActionReport(
  input: BuildOptionsActionReportInput
): Promise<OptionsActionReport> {
  const isGlobalAdminPath = input.subscriptionPlan == null;
  const resolvedPlan = input.subscriptionPlan ?? "basic";
  const planTier: OptionsActionReport["planTier"] = isGlobalAdminPath ? "global_admin" : resolvedPlan;
  const planLimits = getPlanLimits(resolvedPlan);
  const isBasicTier = !isGlobalAdminPath && resolvedPlan === "basic";

  const portfolioId = await getOrProvisionDefaultPortfolioId(input.userId, input.tenantId);
  if (!portfolioId) {
    const generatedAt = new Date().toISOString();
    const asMarkdown = renderOptionsActionReportMarkdown({
      rows: [],
      isBasicTier,
      generatedAtIso: generatedAt
    });
    return {
      planTier,
      truncated: false,
      rows: [],
      generatedAt,
      disclaimer: OPTIONS_SCAN_DISCLAIMER,
      asMarkdown
    };
  }

  const accounts = await listPortfolioAccounts({
    userId: input.userId,
    portfolioId,
    tenantId: input.tenantId
  });
  const accountIds = accounts
    .map((account) => account._id)
    .filter((id): id is ObjectId => Boolean(id));
  const positions =
    accountIds.length > 0
      ? await listPortfolioPositionsByAccount({
          userId: input.userId,
          portfolioId,
          accountIds,
          tenantId: input.tenantId
        })
      : [];

  const optionHoldings = positions
    .map((position) =>
      normalizeOptionHolding({
        symbol: position.symbol,
        optionType: position.optionType,
        strike: position.strike,
        expiration: position.expiration,
        qty: position.qty,
        avgCost: position.avgCost
      })
    )
    .filter((row): row is NormalizedOptionHolding => row !== null);

  const quoteCache = new Map<string, number | null>();
  const holdingRows: OptionsActionReportRow[] = [];
  for (const holding of optionHoldings) {
    const market = await fetchHoldingMarketSnapshot(holding, quoteCache);
    const action = deriveHoldingAction(holding, market);
    holdingRows.push({
      source: "holding",
      symbol: holding.symbol,
      strike: holding.strike,
      exp: holding.expirationIsoDate,
      type: holding.optionType,
      qty: holding.qty,
      ...action
    });
  }

  const watchlistRows: OptionsActionReportRow[] = [];
  if (input.includeWatchlist !== false) {
    const watchlist = await getUserWatchlist({
      userId: input.userId,
      tenantId: input.tenantId
    });
    const holdingSymbols = new Set(holdingRows.map((row) => row.symbol));
    const watchlistSymbols = watchlist?.symbols ?? [];
    for (const entry of watchlistSymbols) {
      const symbol = entry.symbol.trim().toUpperCase();
      if (!symbol || holdingSymbols.has(symbol)) {
        continue;
      }
      if (!quoteCache.has(symbol)) {
        const quote = await getYahooMarketQuote({ symbol }).catch(() => null);
        quoteCache.set(
          symbol,
          quote && typeof quote.price === "number" && Number.isFinite(quote.price) ? quote.price : null
        );
      }
      const action = deriveWatchlistAction({
        symbol,
        entryPrice: entry.entryPrice,
        spotPrice: quoteCache.get(symbol) ?? undefined
      });
      watchlistRows.push({
        source: "watchlist",
        symbol,
        recommendedAction: action.recommendedAction,
        why: action.why,
        urgency: action.urgency,
        targetWindow: action.targetWindow,
        confidence: action.confidence
      });
    }
  }

  const ranked = chooseHighestUrgency([...holdingRows, ...watchlistRows]);
  const maxRows = isBasicTier
    ? MAX_BASIC_HOLDINGS_ROWS
    : Math.min(MAX_PRO_REPORT_ROWS, Math.max(10, planLimits.maxToolCalls * 4));
  const basicFiltered = isBasicTier ? ranked.filter((row) => row.source === "holding") : ranked;
  const rows = basicFiltered.slice(0, maxRows);
  const truncated = basicFiltered.length > rows.length;
  const generatedAt = new Date().toISOString();
  const asMarkdown = renderOptionsActionReportMarkdown({
    rows,
    isBasicTier,
    generatedAtIso: generatedAt
  });

  return {
    planTier,
    truncated,
    rows,
    generatedAt,
    disclaimer: OPTIONS_SCAN_DISCLAIMER,
    asMarkdown
  };
}
