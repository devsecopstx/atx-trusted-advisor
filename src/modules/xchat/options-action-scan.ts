import { ObjectId } from "mongodb";

import {
    getDefaultPortfolio,
    getPortfolioByIdForSessionUser,
    getPortfolioWatchlist,
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

export type OptionsScanRowApplyToWatchlistAction = {
  type: "apply_to_watchlist";
  symbol: string;
  allowPriceAlert: boolean;
  defaultPriceAlertSeverity: "info";
};

export type OptionsActionReportRow = {
  rowId: string;
  source: OptionsActionSource;
  /** Portfolio custodian book (`portfolio_accounts` hex id); holdings only. */
  portfolioAccountId?: string;
  /** Display name for the book; holdings only. */
  portfolioAccountName?: string;
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
  applyToWatchlist: OptionsScanRowApplyToWatchlistAction;
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
  workspacePortfolioId?: string | null;
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

type ActionRecommendation = Omit<
  OptionsActionReportRow,
  "rowId" | "applyToWatchlist" | "source" | "symbol" | "strike" | "exp" | "type" | "qty"
>;

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

async function getWorkspacePortfolioIdOrProvision(input: {
  userId: string;
  tenantId?: string;
  workspacePortfolioId?: string | null;
}): Promise<string | null> {
  const requestedPortfolioId = input.workspacePortfolioId?.trim();
  if (requestedPortfolioId) {
    const selected = await getPortfolioByIdForSessionUser({
      userId: input.userId,
      tenantId: input.tenantId,
      portfolioId: requestedPortfolioId
    });
    if (selected?._id) {
      return selected._id.toHexString();
    }
  }
  const existing = await getDefaultPortfolio(input.userId, { tenantId: input.tenantId });
  if (existing?._id) {
    return existing._id.toHexString();
  }
  try {
    const created = await provisionDefaultPortfolioForUser({
      userId: input.userId,
      tenantId: input.tenantId,
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
): ActionRecommendation {
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
}): ActionRecommendation {
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

function buildReportRowId(row: Omit<OptionsActionReportRow, "rowId" | "applyToWatchlist">, index: number): string {
  const exp = row.exp ?? "na";
  const contractType = row.type ?? "na";
  const book = row.portfolioAccountId ?? "na";
  return [
    row.source,
    book,
    row.symbol,
    exp,
    contractType,
    row.recommendedAction,
    String(index)
  ].join(":");
}

function withApplyAction(
  rows: Array<Omit<OptionsActionReportRow, "rowId" | "applyToWatchlist">>
): OptionsActionReportRow[] {
  return rows.map((row, index) => ({
    ...row,
    rowId: buildReportRowId(row, index),
    applyToWatchlist: {
      type: "apply_to_watchlist",
      symbol: row.symbol,
      allowPriceAlert: true,
      defaultPriceAlertSeverity: "info"
    }
  }));
}

function markdownTableCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

export function renderOptionsActionReportMarkdown(input: {
  rows: OptionsActionReportRow[];
  isBasicTier: boolean;
  generatedAtIso: string;
}): string {
  const header = input.isBasicTier
    ? "| symbol | strike | exp | type | qty | book | action | target_window | confidence |\n|---|---:|---|---|---:|---|---|---|---|"
    : "| source | symbol | strike | exp | type | qty | book | action | why | urgency | target_window | confidence |\n|---|---|---:|---|---|---:|---|---|---|---|---|---|";
  const emptyLine = input.isBasicTier
    ? "| — | — | — | — | — | — | HOLD | monitor | low |"
    : "| — | — | — | — | — | — | — | HOLD | — | low | monitor | low |";
  const lines =
    input.rows.length === 0
      ? [emptyLine]
      : input.rows.map((row) => {
          const strike = row.strike != null ? row.strike.toFixed(2) : "—";
          const exp = row.exp ?? "—";
          const type = row.type ?? "—";
          const qty = row.qty != null ? String(row.qty) : "—";
          const bookRaw =
            row.source === "holding"
              ? row.portfolioAccountName?.trim() ||
                row.portfolioAccountId ||
                "—"
              : "—";
          const book = markdownTableCell(bookRaw);
          if (input.isBasicTier) {
            return `| ${row.symbol} | ${strike} | ${exp} | ${type} | ${qty} | ${book} | ${row.recommendedAction} | ${row.targetWindow} | ${row.confidence} |`;
          }
          return `| ${row.source} | ${row.symbol} | ${strike} | ${exp} | ${type} | ${qty} | ${book} | ${row.recommendedAction} | ${row.why} | ${row.urgency} | ${row.targetWindow} | ${row.confidence} |`;
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

  const portfolioId = await getWorkspacePortfolioIdOrProvision({
    userId: input.userId,
    tenantId: input.tenantId,
    workspacePortfolioId: input.workspacePortfolioId
  });
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

  const accountById = new Map<string, string>();
  for (const account of accounts) {
    const id = account._id?.toHexString();
    if (!id) {
      continue;
    }
    const label =
      typeof account.name === "string" && account.name.trim().length > 0
        ? account.name.trim()
        : typeof account.extAccountId === "string" && account.extAccountId.trim().length > 0
          ? account.extAccountId.trim()
          : "Book";
    accountById.set(id, label);
  }

  const quoteCache = new Map<string, number | null>();
  const holdingRows: Array<Omit<OptionsActionReportRow, "rowId" | "applyToWatchlist">> = [];
  for (const position of positions) {
    const holding = normalizeOptionHolding({
      symbol: position.symbol,
      optionType: position.optionType,
      strike: position.strike,
      expiration: position.expiration,
      qty: position.qty,
      avgCost: position.avgCost
    });
    if (!holding) {
      continue;
    }
    const accountHex = position.accountId?.toHexString?.() ?? "";
    const portfolioAccountName = accountHex ? accountById.get(accountHex) ?? "Book" : undefined;
    const market = await fetchHoldingMarketSnapshot(holding, quoteCache);
    const action = deriveHoldingAction(holding, market);
    holdingRows.push({
      source: "holding",
      symbol: holding.symbol,
      strike: holding.strike,
      exp: holding.expirationIsoDate,
      type: holding.optionType,
      qty: holding.qty,
      portfolioAccountId: accountHex || undefined,
      portfolioAccountName: accountHex ? portfolioAccountName : undefined,
      ...action
    });
  }

  const watchlistRows: Array<Omit<OptionsActionReportRow, "rowId" | "applyToWatchlist">> = [];
  if (input.includeWatchlist !== false) {
    const watchlist = await getPortfolioWatchlist({
      userId: input.userId,
      portfolioId,
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

  const ranked = chooseHighestUrgency(withApplyAction([...holdingRows, ...watchlistRows]));
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
