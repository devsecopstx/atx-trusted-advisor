/**
 * Step 4 “Review order” copy — preview only; not a live order or tax advice.
 * Uses standard equity option multiplier: 1 contract = 100 shares.
 */

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

function breakevenPerShare(side: "call" | "put", strike: number, premiumPerShare: number): number {
  if (side === "call") {
    return strike + premiumPerShare;
  }
  return Math.max(0, strike - premiumPerShare);
}

export type XoptionsOrderReview = {
  bidPerShareDisplay: string;
  breakevenDisplay: string;
  probabilityOtmDisplay: string;
  /** 0–100 when IV allows model; drives semi-circular gauge. */
  probabilityOtmPercent: number | null;
  narrative: string;
  strategyLabel?: string | null;
};

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
    "xOptions — Review order",
    "",
    `Limit (bid): ${review.bidPerShareDisplay}`,
    `Breakeven (BE): ${review.breakevenDisplay}`,
    `Probability of being OTM: ${review.probabilityOtmDisplay}`,
    "",
    review.narrative.trim()
  ];
  if (!includeFootnote) {
    return lines.join("\n");
  }
  return [...lines, "", XOPTIONS_REVIEW_ORDER_FOOTNOTE].join("\n");
}

/**
 * Structured review: limit (bid), BE, estimated P(OTM), and long-option narrative.
 */
export function buildXoptionsOrderReview(input: {
  symbol: string;
  expirationYyyyMmDd: string;
  side: "call" | "put";
  strike: number;
  limitPrice: string;
  quantity: string;
  spot: number;
  impliedVolatilityPercent?: number | null;
  strategyLabel?: string | null;
}): XoptionsOrderReview {
  const sym = input.symbol.trim().toUpperCase();
  const exp = formatExpirationShortLabel(input.expirationYyyyMmDd);
  const qty = parsePositiveInt(input.quantity);
  const prem = parseLimitPerShare(input.limitPrice);
  const premium = prem ?? 0;
  const contracts = qty;
  const shares = contracts * 100;
  const maxDebit = contracts * 100 * premium;
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

  const bidPerShareDisplay = prem != null ? usd(prem) : "—";
  const breakevenDisplay = usd(be);
  const probabilityOtmDisplay = prob != null ? `${prob}%` : "—";

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
  if (input.side === "call") {
    const totalBuy = input.strike * shares;
    exerciseSentence = ` If you exercise, you have the right to buy ${shares.toLocaleString()} shares of ${sym} at $${input.strike.toFixed(2)} per share, for a total purchase price of ${usd(totalBuy)}.`;
  } else {
    const totalSell = input.strike * shares;
    exerciseSentence = ` If you exercise, you have the right to sell ${shares.toLocaleString()} shares of ${sym} at $${input.strike.toFixed(2)} per share, for total proceeds of ${usd(totalSell)}.`;
  }

  const strat = input.strategyLabel?.trim();
  const stratSuffix = strat ? ` Strategy context: ${strat}.` : "";

  const narrative = `You are buying ${contracts} ${sym} ${optionNoun} to open with the strike price of $${input.strike.toFixed(2)} that expires ${exp}. At your limit of ${usd(premium)} per share, this order implies a maximum debit of ${usd(maxDebit)}.${probClause}${exerciseSentence}${stratSuffix}.`;

  return {
    bidPerShareDisplay,
    breakevenDisplay,
    probabilityOtmDisplay,
    probabilityOtmPercent: prob,
    narrative,
    strategyLabel: input.strategyLabel ?? null
  };
}
