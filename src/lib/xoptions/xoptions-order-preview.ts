/**
 * Step 4 “Review order” copy — preview only; not a live order or tax advice.
 * Uses standard equity option multiplier: 1 contract = 100 shares.
 */

import { z } from "zod";

export function formatExpirationShortLabel(yyyyMmDd: string): string {
  try {
    const d = new Date(`${yyyyMmDd.slice(0, 10)}T12:00:00.000Z`);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return yyyyMmDd;
  }
}

function usd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function parsePositiveInt(qty: string): number {
  const n = parseInt(qty, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function parseLimitPerShare(limitPrice: string): number | null {
  const p = parseFloat(limitPrice.trim());
  return limitPrice.trim() !== "" && Number.isFinite(p) && p >= 0 ? p : null;
}

/** Calendar days from now to expiration end (min 1). */
export function daysToExpirationUtc(yyyyMmDd: string): number {
  try {
    const exp = new Date(`${yyyyMmDd.slice(0, 10)}T23:59:59.000Z`);
    const ms = exp.getTime() - Date.now();
    return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  } catch {
    return 1;
  }
}

/** Standard normal CDF Φ(x), Hart / Abramowitz-style approximation. */
export function normalCdf(x: number): number {
  if (x <= -8) {
    return 0;
  }
  if (x >= 8) {
    return 1;
  }
  const a1 = 0.319381530;
  const a2 = -0.356563782;
  const a3 = 1.781477937;
  const a4 = -1.821255978;
  const a5 = 1.330274429;
  const p = 0.2316419;
  const t = 1 / (1 + p * Math.abs(x));
  const y =
    1 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
      t *
      Math.exp(-0.5 * x * x) *
      0.39894228040143267;
  return x >= 0 ? y : 1 - y;
}

/**
 * Risk-neutral approx. probability of expiring OTM at expiry (European-style),
 * using Black–Scholes d2. Call OTM = S_T < K; put OTM = S_T > K.
 * Returns integer percent 0–100, or null if inputs insufficient.
 */
export function estimateOtmProbabilityPercent(input: {
  side: "call" | "put";
  spot: number;
  strike: number;
  ivPercent: number | null | undefined;
  expirationYyyyMmDd: string;
  riskFreeRate?: number;
}): number | null {
  const { side, spot, strike, ivPercent, expirationYyyyMmDd } = input;
  const r = input.riskFreeRate ?? 0.05;
  if (!Number.isFinite(spot) || spot <= 0 || !Number.isFinite(strike) || strike <= 0) {
    return null;
  }
  if (ivPercent == null || !Number.isFinite(ivPercent) || ivPercent <= 0) {
    return null;
  }
  const sigma = ivPercent / 100;
  const T = Math.max(daysToExpirationUtc(expirationYyyyMmDd), 1) / 365;
  const d2 =
    (Math.log(spot / strike) + (r - 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  let pOtm: number;
  if (side === "call") {
    pOtm = 1 - normalCdf(d2);
  } else {
    pOtm = 1 - normalCdf(-d2);
  }
  return Math.min(100, Math.max(0, Math.round(pOtm * 100)));
}

/**
 * Risk-neutral estimate of probability the position finishes profitable at expiry
 * (call: S_T &gt; breakeven; put: S_T &lt; breakeven), using the same IV and tenor as other chain metrics.
 */
export function estimateProbabilityProfitAtExpiryPercent(input: {
  side: "call" | "put";
  spot: number;
  strike: number;
  premiumPerShare: number;
  ivPercent: number | null | undefined;
  expirationYyyyMmDd: string;
  riskFreeRate?: number;
}): number | null {
  const { side, spot, strike, premiumPerShare, ivPercent, expirationYyyyMmDd } = input;
  if (ivPercent == null || !Number.isFinite(ivPercent) || ivPercent <= 0) {
    return null;
  }
  if (!Number.isFinite(spot) || spot <= 0 || !Number.isFinite(strike) || strike <= 0) {
    return null;
  }
  if (!Number.isFinite(premiumPerShare) || premiumPerShare < 0) {
    return null;
  }
  const sigma = ivPercent / 100;
  const T = Math.max(daysToExpirationUtc(expirationYyyyMmDd), 1) / 365;
  const r = input.riskFreeRate ?? 0.05;
  const be = side === "call" ? strike + premiumPerShare : Math.max(0, strike - premiumPerShare);
  if (be <= 0) {
    return null;
  }
  const d2 = (Math.log(spot / be) + (r - 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  if (side === "call") {
    return Math.min(100, Math.max(0, Math.round(normalCdf(d2) * 100)));
  }
  return Math.min(100, Math.max(0, Math.round((1 - normalCdf(d2)) * 100)));
}

/** Breakeven stock price at expiration (per share), before fees. */
export function breakevenPerShare(side: "call" | "put", strike: number, premiumPerShare: number): number {
  if (side === "call") {
    return strike + premiumPerShare;
  }
  return Math.max(0, strike - premiumPerShare);
}

/** Sample notional for “portfolio delta impact” copy (HNWI review). */
export const SAMPLE_PORTFOLIO_USD = 250_000;

/**
 * Annualized yield on premium / secured notional for short premium (sell-to-open).
 * Returns null for long premium or invalid inputs.
 */
export function computeAnnualizedPremiumYieldPercent(input: {
  openingAction: "buy_to_open" | "sell_to_open";
  grossPremiumUsd: number;
  securedNotionalUsd: number | null;
  expirationYyyyMmDd: string;
}): number | null {
  if (input.openingAction !== "sell_to_open") {
    return null;
  }
  if (
    !Number.isFinite(input.grossPremiumUsd) ||
    input.grossPremiumUsd <= 0 ||
    input.securedNotionalUsd == null ||
    !Number.isFinite(input.securedNotionalUsd) ||
    input.securedNotionalUsd <= 0
  ) {
    return null;
  }
  const dte = daysToExpirationUtc(input.expirationYyyyMmDd);
  const periodReturn = input.grossPremiumUsd / input.securedNotionalUsd;
  const annualized = periodReturn * (365 / Math.max(dte, 1));
  return Math.min(999, Math.max(0, annualized * 100));
}

/** Approximate dollar delta: net share delta × spot. */
export function computeDollarDeltaApproxUsd(netDeltaShares: number | null, spot: number): number | null {
  if (netDeltaShares == null || !Number.isFinite(netDeltaShares) || !Number.isFinite(spot) || spot <= 0) {
    return null;
  }
  return netDeltaShares * spot;
}

/**
 * One-line copy: option leg vs a $250k sleeve in the same stock (illustrative).
 */
export function computeSamplePortfolioDeltaLine(
  netDeltaShares: number | null,
  spot: number,
  symbol: string
): string | null {
  if (netDeltaShares == null || !Number.isFinite(spot) || spot <= 0) {
    return null;
  }
  const sleeveShares = SAMPLE_PORTFOLIO_USD / spot;
  if (!Number.isFinite(sleeveShares) || sleeveShares <= 0) {
    return null;
  }
  const pct = (netDeltaShares / sleeveShares) * 100;
  const sym = symbol.trim().toUpperCase();
  return `Leg delta ≈ ${pct >= 0 ? "" : "−"}${Math.abs(pct).toFixed(2)}% of a $${(SAMPLE_PORTFOLIO_USD / 1e3).toFixed(0)}k ${sym} sleeve (illustrative).`;
}

/**
 * Max structured gain label for payoff (short call: premium + intrinsic cap to strike; long call: uncapped).
 */
export function computeCappedUpsideDisplay(input: {
  openingAction: "buy_to_open" | "sell_to_open";
  side: "call" | "put";
  strike: number;
  spot: number;
  premiumPerShare: number;
  contracts: number;
}): string | null {
  const m = input.contracts * 100;
  if (input.openingAction === "sell_to_open" && input.side === "call") {
    const maxPerShare = input.premiumPerShare + Math.max(0, input.strike - input.spot);
    return `Capped upside ${usd(maxPerShare * m)} (at or above strike, model)`;
  }
  if (input.openingAction === "sell_to_open" && input.side === "put") {
    return `Max gain ${usd(input.premiumPerShare * m)} (premium if expires OTM)`;
  }
  if (input.openingAction === "buy_to_open" && input.side === "call") {
    return "Uncapped upside (calls; before fees)";
  }
  if (input.openingAction === "buy_to_open" && input.side === "put") {
    const maxPut = Math.max(0, input.strike - input.premiumPerShare) * m;
    return `Max gain ${usd(maxPut)} (if ${input.strike.toFixed(2)} strike, stock → $0)`;
  }
  return null;
}

export const xoptionsOrderReviewInputSchema = z.object({
  symbol: z.string().min(1),
  expirationYyyyMmDd: z.string().min(8),
  side: z.enum(["call", "put"]),
  openingAction: z.enum(["buy_to_open", "sell_to_open"]).optional(),
  strike: z.number().finite().positive(),
  limitPrice: z.string(),
  quantity: z.string(),
  spot: z.number().finite().positive(),
  impliedVolatilityPercent: z.number().finite().nonnegative().nullable().optional(),
  strategyLabel: z.string().nullable().optional(),
  legDelta: z.number().finite().nullable().optional()
});

export type XoptionsOrderReviewInput = z.infer<typeof xoptionsOrderReviewInputSchema>;

export type XoptionsOpeningAction = "buy_to_open" | "sell_to_open";

export type XoptionsOrderReview = {
  bidPerShareDisplay: string;
  breakevenDisplay: string;
  probabilityOtmDisplay: string;
  /** 0–100 when IV allows model; drives semi-circular gauge. */
  probabilityOtmPercent: number | null;
  /** Est. P(profit at expiry) under risk-neutral measure; 0–100 when IV allows. */
  probabilityProfitPercent: number | null;
  probabilityProfitDisplay: string;
  maxLossDisplay: string;
  /** Debit / defined-risk line in USD when applicable. */
  maxLossUsd: number | null;
  /** Approximate portfolio delta impact of this leg (per-share delta × contracts × 100). */
  netDeltaApprox: number | null;
  expectedValueNote: string;
  /** Short label for grid (“Not modeled”). */
  expectedValueDisplay: string;
  narrative: string;
  strategyLabel?: string | null;
  /** One-line strategy description for review header. */
  strategyOneLiner: string;
  /** Premium / secured notional, annualized (short premium only). */
  annualizedPremiumYieldPercent: number | null;
  /** Collateral or debit line for risk context. */
  capitalAtRiskDisplay: string;
  /** Approximate $ delta (shares × spot). */
  dollarDeltaApproxUsd: number | null;
  samplePortfolioDeltaLine: string | null;
  cappedUpsideDisplay: string | null;
  /** One-line broker-style ticket: side, symbol, strike, right, exp, limit, est premium, max loss. */
  brokerTicketLine: string;
};

function buildBrokerTicketLine(input: {
  openingAction: XoptionsOpeningAction;
  symbol: string;
  side: "call" | "put";
  strike: number;
  expirationYyyyMmDd: string;
  limitPerShare: number;
  contracts: number;
  grossPremiumUsd: number;
  maxLossDisplay: string;
}): string {
  const verb = input.openingAction === "sell_to_open" ? "SELL TO OPEN" : "BUY TO OPEN";
  const right = input.side === "call" ? "CALL" : "PUT";
  const exp = formatExpirationShortLabel(input.expirationYyyyMmDd);
  const lim = `@ $${input.limitPerShare.toFixed(2)}/sh`;
  const estPrem = usd(input.grossPremiumUsd);
  return `${verb} · ${input.contracts}× ${input.symbol} $${input.strike.toFixed(2)} ${right} · ${exp} · ${lim} · Est premium ${estPrem} · Max loss ${input.maxLossDisplay}`;
}

/** Footnote under Review order narrative in the panel only — not sent to xChat / clipboard handoff. */
export const XOPTIONS_REVIEW_ORDER_FOOTNOTE =
  "prices data source.yahoo - delayed 15 mins. Model P(OTM) uses IV from the chain when available; actual outcomes differ.";

/** Plain-text export of Review order; default includes footnote. Use `includeFootnote: false` for Ask xChat. */
export function formatXoptionsOrderReviewPlainText(
  review: XoptionsOrderReview,
  options?: { includeFootnote?: boolean }
): string {
  const includeFootnote = options?.includeFootnote ?? true;
  const lines = [
    "xOptions — Position review",
    "",
    review.brokerTicketLine,
    "",
    `Limit: ${review.bidPerShareDisplay}`,
    `Breakeven: ${review.breakevenDisplay}`,
    `P(OTM): ${review.probabilityOtmDisplay}`,
    `POP (est.): ${review.probabilityProfitDisplay}`,
    `Expected value: ${review.expectedValueDisplay}`,
    `Max loss: ${review.maxLossDisplay}`,
    `Capital at risk: ${review.capitalAtRiskDisplay}`,
    review.annualizedPremiumYieldPercent != null
      ? `Annualized premium yield (model): ${review.annualizedPremiumYieldPercent.toFixed(1)}%`
      : "Annualized premium yield (model): —",
    review.samplePortfolioDeltaLine ?? "Portfolio delta (sample): —",
    review.dollarDeltaApproxUsd != null
      ? `Delta $ (approx.): ${usd(review.dollarDeltaApproxUsd)}`
      : "Delta $ (approx.): —",
    review.netDeltaApprox != null
      ? `Net delta (shares): ${review.netDeltaApprox.toFixed(2)}`
      : "Net delta (shares): —",
    "",
    review.narrative.trim()
  ];
  if (!includeFootnote) {
    return lines.join("\n");
  }
  return [...lines, "", XOPTIONS_REVIEW_ORDER_FOOTNOTE].join("\n");
}

/**
 * Structured review: limit (bid), BE, estimated P(OTM), and narrative. Validates input with Zod.
 */
export function buildXoptionsOrderReview(
  raw: z.input<typeof xoptionsOrderReviewInputSchema>
): XoptionsOrderReview {
  const input = xoptionsOrderReviewInputSchema.parse(raw);
  const sym = input.symbol.trim().toUpperCase();
  const exp = formatExpirationShortLabel(input.expirationYyyyMmDd);
  const qty = parsePositiveInt(input.quantity);
  const prem = parseLimitPerShare(input.limitPrice);
  const openingAction = input.openingAction ?? "buy_to_open";
  const premium = prem ?? 0;
  const contracts = qty;
  const shares = contracts * 100;
  const grossValue = contracts * 100 * premium;
  const be = breakevenPerShare(input.side, input.strike, premium);
  const prob =
    prem != null && prem >= 0
      ? estimateOtmProbabilityPercent({
          side: input.side,
          spot: input.spot,
          strike: input.strike,
          ivPercent: input.impliedVolatilityPercent,
          expirationYyyyMmDd: input.expirationYyyyMmDd
        })
      : null;

  const probProfit =
    prem != null && prem >= 0
      ? estimateProbabilityProfitAtExpiryPercent({
          side: input.side,
          spot: input.spot,
          strike: input.strike,
          premiumPerShare: premium,
          ivPercent: input.impliedVolatilityPercent,
          expirationYyyyMmDd: input.expirationYyyyMmDd
        })
      : null;

  const legDelta = input.legDelta;
  const netDeltaApprox =
    legDelta != null && Number.isFinite(legDelta) ? legDelta * contracts * 100 : null;

  let maxLossDisplay: string;
  const maxLossUsd = openingAction === "buy_to_open" ? grossValue : null;
  if (openingAction === "buy_to_open") {
    maxLossDisplay = usd(grossValue);
  } else {
    maxLossDisplay = "Not a fixed debit (short premium)";
  }

  const bidPerShareDisplay = prem != null ? usd(prem) : "—";
  const breakevenDisplay = usd(be);
  const probabilityOtmDisplay = prob != null ? `${prob}%` : "—";
  const probabilityProfitDisplay = probProfit != null ? `${probProfit}%` : "—";

  const optWordPlural = input.side === "call" ? "calls" : "puts";
  const optWordSingular = input.side === "call" ? "call" : "put";
  const optionNoun = contracts === 1 ? optWordSingular : optWordPlural;
  const probClause =
    prob != null
      ? ` This position has an estimated ${prob}% probability of expiring out of the money${
          input.side === "call"
            ? ` (with ${sym} finishing below the $${input.strike.toFixed(2)} strike at expiration).`
            : ` (with ${sym} finishing above the $${input.strike.toFixed(2)} strike at expiration).`
        }`
      : " Estimated probability of expiring out of the money requires implied volatility from the chain.";

  let exerciseSentence: string;
  if (openingAction === "buy_to_open") {
    if (input.side === "call") {
      const totalBuy = input.strike * shares;
      exerciseSentence = ` If you exercise, you have the right to buy ${shares.toLocaleString()} shares of ${sym} at $${input.strike.toFixed(2)} per share, for a total purchase price of ${usd(totalBuy)}.`;
    } else {
      const totalSell = input.strike * shares;
      exerciseSentence = ` If you exercise, you have the right to sell ${shares.toLocaleString()} shares of ${sym} at $${input.strike.toFixed(2)} per share, for total proceeds of ${usd(totalSell)}.`;
    }
  } else if (input.side === "call") {
    const totalSell = input.strike * shares;
    exerciseSentence = ` If assigned, you may be obligated to sell ${shares.toLocaleString()} shares of ${sym} at $${input.strike.toFixed(2)} per share, for total proceeds of ${usd(totalSell)}.`;
  } else {
    const totalBuy = input.strike * shares;
    exerciseSentence = ` If assigned, you may be obligated to buy ${shares.toLocaleString()} shares of ${sym} at $${input.strike.toFixed(2)} per share, for a total purchase price of ${usd(totalBuy)}.`;
  }

  const strat = input.strategyLabel?.trim();
  const stratSuffix = strat ? ` Strategy context: ${strat}.` : "";

  const openVerb = openingAction === "buy_to_open" ? "buying" : "selling";
  const cashFlowPhrase =
    openingAction === "buy_to_open"
      ? `this order implies a maximum debit of ${usd(grossValue)}`
      : `this order implies a maximum credit of ${usd(grossValue)}`;
  const securedNotional =
    openingAction === "sell_to_open" ? input.strike * shares : null;
  const potentialEarningPct =
    openingAction === "sell_to_open" && securedNotional && securedNotional > 0
      ? (grossValue / securedNotional) * 100
      : null;
  const potentialEarningSentence =
    potentialEarningPct != null
      ? ` Potential earning: ${potentialEarningPct.toFixed(1)}% of secured notional (${usd(securedNotional ?? 0)}).`
      : "";
  const narrative = `You are ${openVerb} ${contracts} ${sym} ${optionNoun} to open with the strike price of $${input.strike.toFixed(2)} that expires ${exp}. At your limit of ${usd(premium)} per share, ${cashFlowPhrase}.${probClause}${exerciseSentence}${stratSuffix}.`;
  const narrativeWithEarning =
    potentialEarningSentence.length > 0
      ? `${narrative}${potentialEarningSentence}`
      : narrative;

  const capitalAtRiskDisplay =
    openingAction === "buy_to_open"
      ? usd(grossValue)
      : securedNotional != null && securedNotional > 0
        ? usd(securedNotional)
        : "—";

  const annualizedPremiumYieldPercent = computeAnnualizedPremiumYieldPercent({
    openingAction,
    grossPremiumUsd: grossValue,
    securedNotionalUsd: securedNotional,
    expirationYyyyMmDd: input.expirationYyyyMmDd
  });

  const dollarDeltaApproxUsd = computeDollarDeltaApproxUsd(netDeltaApprox, input.spot);
  const samplePortfolioDeltaLine = computeSamplePortfolioDeltaLine(netDeltaApprox, input.spot, sym);

  const cappedUpsideDisplay = computeCappedUpsideDisplay({
    openingAction,
    side: input.side,
    strike: input.strike,
    spot: input.spot,
    premiumPerShare: premium,
    contracts
  });

  const stratTitle = strat && strat.length > 0 ? strat : `${sym} ${optionNoun}`;
  const strategyOneLiner = `${stratTitle}: ${openingAction === "sell_to_open" ? "Collect" : "Pay"} ${usd(premium)}/sh · ${contracts} lot · exp ${exp}.`;

  const brokerTicketLine = buildBrokerTicketLine({
    openingAction,
    symbol: sym,
    side: input.side,
    strike: input.strike,
    expirationYyyyMmDd: input.expirationYyyyMmDd,
    limitPerShare: premium,
    contracts,
    grossPremiumUsd: grossValue,
    maxLossDisplay
  });

  return {
    bidPerShareDisplay,
    breakevenDisplay,
    probabilityOtmDisplay,
    probabilityOtmPercent: prob,
    probabilityProfitPercent: probProfit,
    probabilityProfitDisplay,
    maxLossDisplay,
    maxLossUsd,
    netDeltaApprox,
    expectedValueNote:
      "Expected mark-to-market P/L and expected value at expiry are not modeled here. Use xChat for scenario analysis.",
    expectedValueDisplay: "Not modeled",
    narrative: narrativeWithEarning,
    strategyLabel: input.strategyLabel ?? null,
    strategyOneLiner,
    annualizedPremiumYieldPercent,
    capitalAtRiskDisplay,
    dollarDeltaApproxUsd,
    samplePortfolioDeltaLine,
    cappedUpsideDisplay,
    brokerTicketLine
  };
}
