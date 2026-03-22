/**
 * Option chain + synthetic fallback — ported from xfinance-strategy
 * `apps/frontend/src/app/api/options/route.ts` (keep behavior aligned on upstream changes).
 */
import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

import {
    parseStrike,
    parseUnderlying,
    validateNormalizedExpiration
} from "@/modules/strategy-options/query-validation";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// Type definitions for options data
type OptionContractData = {
  ticker: string;
  yahoo_symbol: string;
  strike_price: number;
  expiration_date: string;
  contract_type: "call" | "put";
  premium: number;
  totalPremium: number;
  last_quote: {
    bid: number;
    ask: number;
  };
  volume: number;
  open_interest: number;
  implied_volatility: number;
  rationale: string;
  /** Risk-neutral P(stock > strike at expiration); calls only. 0–1. */
  probability_called_away?: number;
  /** Risk-neutral P(stock > strike at expiration) = expire OTM; puts only. 0–1. */
  probability_expire_otm?: number;
  dataSource: string;
};

// Convert to Yahoo Finance option symbol format: TSLA260130C00170000
function toYahooSymbol(
  underlying: string,
  expiration: string,
  contractType: "call" | "put",
  strikePrice: number
): string {
  // Format: SYMBOL + YYMMDD + C/P + Strike*1000 (8 digits)
  const expDate = expiration.replace(/-/g, "").slice(2); // YYMMDD
  const typeChar = contractType === "call" ? "C" : "P";
  const strikeStr = String(Math.round(strikePrice * 1000)).padStart(8, "0");
  return `${underlying}${expDate}${typeChar}${strikeStr}`;
}

// Standard normal CDF approximation (Abramowitz & Stegun 26.2.17)
function normCDF(x: number): number {
  const b1 = 0.31938153, b2 = -0.356563782, b3 = 1.781477937, b4 = -1.821255978, b5 = 1.330274429;
  const p = 0.2316419;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1.0 / (1.0 + p * x);
  const phi = Math.exp(-(x * x) / 2) / Math.sqrt(2 * Math.PI);
  const y = 1.0 - phi * (b1 * t + b2 * t * t + b3 * t * t * t + b4 * t * t * t * t + b5 * t * t * t * t * t);
  return sign < 0 ? 1.0 - y : y;
}

// Risk-neutral probability of finishing ITM at expiration (P(S > K) for call) = N(d2)
function probabilityCalledAway(
  stockPrice: number,
  strikePrice: number,
  daysToExpiration: number,
  ivDecimal: number
): number {
  if (stockPrice <= 0 || strikePrice <= 0 || daysToExpiration <= 0 || ivDecimal <= 0) return 0;
  const T = daysToExpiration / 365;
  const sigma = ivDecimal;
  const r = 0.05;
  const d2 = (Math.log(stockPrice / strikePrice) + (r - (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  return normCDF(d2);
}

// Estimate implied volatility based on premium and time
function estimateIV(
  stockPrice: number,
  strikePrice: number,
  premium: number,
  daysToExpiration: number,
  isCall: boolean
): number {
  // Simplified IV approximation using Brenner-Subrahmanyam formula
  // IV ≈ premium / (0.4 * stockPrice * sqrt(T))
  const timeYears = daysToExpiration / 365;
  if (timeYears <= 0) return 0;

  const atTheMoneyApprox = premium / (0.4 * stockPrice * Math.sqrt(timeYears));

  // Adjust for moneyness
  const moneyness = isCall
    ? stockPrice / strikePrice
    : strikePrice / stockPrice;
  const moneynessAdj = 1 + Math.abs(1 - moneyness) * 0.3;

  const iv = atTheMoneyApprox * moneynessAdj;
  return Math.min(2.0, Math.max(0.1, iv)); // Cap between 10% and 200%
}

// Generate rationale based on option characteristics; probCalledAway 0–1 for calls only
function generateRationale(
  stockPrice: number,
  strikePrice: number,
  contractType: "call" | "put",
  iv: number,
  daysToExp: number,
  probCalledAway?: number
): string {
  const otmPercent = contractType === "call"
    ? ((strikePrice - stockPrice) / stockPrice) * 100
    : ((stockPrice - strikePrice) / stockPrice) * 100;

  const isITM = contractType === "call"
    ? strikePrice < stockPrice
    : strikePrice > stockPrice;
  const isATM = Math.abs(otmPercent) < 2;

  // Moneyness description
  let moneyness: string;
  if (isATM) {
    moneyness = "ATM";
  } else if (isITM) {
    moneyness = `${Math.abs(otmPercent).toFixed(0)}% ITM`;
  } else {
    moneyness = `${otmPercent.toFixed(0)}% OTM`;
  }

  // Strategy suggestion
  let strategy: string;
  if (contractType === "call") {
    if (isATM || (otmPercent > 0 && otmPercent <= 5)) {
      strategy = "Good STO"; // Sell to open - covered call sweet spot
    } else if (otmPercent > 5 && otmPercent <= 10) {
      strategy = "Safe STO"; // More conservative
    } else if (otmPercent > 10) {
      strategy = "Low premium"; // Far OTM
    } else if (isITM && Math.abs(otmPercent) <= 5) {
      strategy = "Higher assign risk";
    } else {
      strategy = "Deep ITM";
    }
  } else {
    // Puts
    if (isATM || (otmPercent > 0 && otmPercent <= 5)) {
      strategy = "CSP target"; // Cash secured put
    } else if (otmPercent > 5 && otmPercent <= 10) {
      strategy = "Safe CSP";
    } else if (otmPercent > 10) {
      strategy = "Low premium";
    } else {
      strategy = isITM ? "ITM put" : "Protective";
    }
  }

  // IV note
  const ivNote = iv > 0.5 ? " • High IV" : iv < 0.25 ? " • Low IV" : "";

  // For calls: add probability of being called away (P(S > K) at exp)
  const callAwayNote =
    contractType === "call" && probCalledAway != null
      ? ` • ~${Math.round(probCalledAway * 100)}% call away`
      : "";

  return `${moneyness} • ${strategy}${ivNote}${callAwayNote}`;
}

// Estimate volume (synthetic - based on moneyness and expiration)
function estimateVolume(
  stockPrice: number,
  strikePrice: number,
  daysToExpiration: number
): number {
  // ATM options have highest volume, decreases further OTM
  const moneyness = Math.abs(stockPrice - strikePrice) / stockPrice;
  const moneynessMultiplier = Math.max(0.1, 1 - moneyness * 5);

  // Nearer expiration = higher volume
  const timeMultiplier = daysToExpiration < 30 ? 2 : daysToExpiration < 60 ? 1.5 : 1;

  // Base volume estimate
  const baseVolume = 500;
  return Math.round(baseVolume * moneynessMultiplier * timeMultiplier);
}

// Estimate open interest (synthetic) - correlates with volume & closeness to ATM
function estimateOpenInterest(
  stockPrice: number,
  strikePrice: number,
  daysToExpiration: number
): number {
  const moneyness = Math.abs(stockPrice - strikePrice) / stockPrice;
  const moneynessMultiplier = Math.max(0.08, 1 - moneyness * 4.5);
  const timeMultiplier = daysToExpiration < 30 ? 1.4 : daysToExpiration < 60 ? 1.15 : 1;
  const baseOi = 3500;
  return Math.max(10, Math.round(baseOi * moneynessMultiplier * timeMultiplier));
}

// Simple premium estimation using time value approximation
function estimatePremium(
  stockPrice: number,
  strikePrice: number,
  daysToExpiration: number,
  isCall: boolean = true
): { bid: number; ask: number; premium: number } {
  // Intrinsic value
  const intrinsic = isCall
    ? Math.max(0, stockPrice - strikePrice)
    : Math.max(0, strikePrice - stockPrice);

  // Time value estimation (simplified - roughly 0.5-2% of stock price per month)
  const monthsToExp = daysToExpiration / 30;
  const volatilityFactor = 0.015;
  const moneyness = stockPrice / strikePrice;

  // ATM options have highest time value
  const moneynessAdjustment = 1 - Math.abs(1 - moneyness) * 0.5;
  const timeValue =
    stockPrice * volatilityFactor * Math.sqrt(monthsToExp) * moneynessAdjustment;

  const premium = intrinsic + Math.max(timeValue, 0.05);

  // Simulate bid-ask spread
  const spread = premium * 0.08;
  const bid = Math.max(0.01, premium - spread / 2);
  const ask = premium + spread / 2;

  return {
    bid: Math.round(bid * 100) / 100,
    ask: Math.round(ask * 100) / 100,
    premium: Math.round(premium * 100) / 100,
  };
}

// Generate synthetic option chain when API is unavailable
function generateSyntheticOptions(
  underlying: string,
  expiration: string,
  targetStrike: number,
  contractType: "call" | "put",
  stockPrice: number,
  daysToExp: number
) {
  const strikeTolerance = targetStrike * 0.15;
  const minStrike = targetStrike - strikeTolerance;
  const maxStrike = targetStrike + strikeTolerance;

  // Generate strikes at appropriate intervals
  const increment = stockPrice < 100 ? 2.5 : stockPrice < 500 ? 5 : 10;
  const strikes: number[] = [];

  let strike = Math.floor(minStrike / increment) * increment;
  while (strike <= maxStrike) {
    if (strike > 0) strikes.push(strike);
    strike += increment;
  }

  return strikes.map((strikePrice) => {
    const priceEstimate = estimatePremium(
      stockPrice,
      strikePrice,
      daysToExp,
      contractType === "call"
    );

    const iv = estimateIV(stockPrice, strikePrice, priceEstimate.premium, daysToExp, contractType === "call");
    const volume = estimateVolume(stockPrice, strikePrice, daysToExp);
    const openInterest = estimateOpenInterest(stockPrice, strikePrice, daysToExp);
    const probOtm = probabilityCalledAway(stockPrice, strikePrice, daysToExp, iv);
    const probCalledAway = contractType === "call" ? probOtm : undefined;
    const probExpireOtm = contractType === "put" ? probOtm : undefined;
    const rationale = generateRationale(
      stockPrice,
      strikePrice,
      contractType,
      iv,
      daysToExp,
      probCalledAway
    );
    const yahooSymbol = toYahooSymbol(underlying, expiration, contractType, strikePrice);

    return {
      ticker: `O:${underlying}${expiration.replace(/-/g, "").slice(2)}${contractType === "call" ? "C" : "P"}${String(Math.round(strikePrice * 1000)).padStart(8, "0")}`,
      yahoo_symbol: yahooSymbol,
      strike_price: strikePrice,
      expiration_date: expiration,
      contract_type: contractType,
      premium: priceEstimate.premium,
      totalPremium: priceEstimate.premium * 100,
      last_quote: {
        bid: priceEstimate.bid,
        ask: priceEstimate.ask,
      },
      volume,
      open_interest: openInterest,
      implied_volatility: Math.round(iv * 1000) / 10, // As percentage (e.g., 35.5%)
      rationale,
      probability_called_away: probCalledAway,
      probability_expire_otm: probExpireOtm,
      dataSource: "synthetic",
    };
  });
}

async function fetchOptionsForType(
  underlying: string,
  targetExpiration: string,
  targetStrike: number,
  contractType: "call" | "put",
  stockPrice: number,
  daysToExp: number
): Promise<{ options: OptionContractData[]; synthetic: boolean }> {
  return {
    options: generateSyntheticOptions(underlying, targetExpiration, targetStrike, contractType, stockPrice, daysToExp),
    synthetic: true,
  };
}

// Yahoo options contract shape (from yahoo-finance2 options module)
type YahooCallOrPut = {
  contractSymbol: string;
  strike: number;
  lastPrice: number;
  bid?: number;
  ask?: number;
  volume?: number;
  openInterest?: number;
  impliedVolatility?: number;
  expiration: Date;
};

type YahooOptionGroup = {
  expirationDate: Date;
  calls: YahooCallOrPut[];
  puts: YahooCallOrPut[];
};

// Normalize Date to YYYY-MM-DD (UTC) for comparison - handles midnight vs 4pm ET expirations
function toDateString(d: Date): string {
  const x = d instanceof Date ? d : new Date(d);
  const y = x.getUTCFullYear();
  const m = String(x.getUTCMonth() + 1).padStart(2, "0");
  const day = String(x.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const OPTIONS_LOG = "[strategy-options]";

/** Normalize expiration to YYYY-MM-DD. Accepts YYYY-MM-DD or Yahoo-style Unix timestamp (seconds). */
function normalizeExpiration(expiration: string): string {
  const trimmed = expiration.trim();
  const asUnix = parseInt(trimmed, 10);
  if (Number.isInteger(asUnix) && asUnix >= 1e9 && asUnix <= 2e9) {
    return new Date(asUnix * 1000).toISOString().slice(0, 10);
  }
  return trimmed.slice(0, 10);
}

// Find expiration group matching YYYY-MM-DD from options array; fallback to closest by date.
// Prefer future expirations when requested date is ahead (avoids showing Jan 30 when user picked 4w = Feb 27).
function findExpirationGroup(options: YahooOptionGroup[], expTarget: string): YahooOptionGroup {
  const exact = options.find((g) => {
    const d = g.expirationDate instanceof Date ? g.expirationDate : new Date(g.expirationDate);
    return toDateString(d) === expTarget;
  });
  if (exact) {
    return exact;
  }
  const targetTime = new Date(expTarget + "T00:00:00Z").getTime();
  const future = options.filter((g) => {
    const d = g.expirationDate instanceof Date ? g.expirationDate : new Date(g.expirationDate);
    return d.getTime() >= targetTime;
  });
  // Prefer nearest future expiration when user requested a future date
  if (future.length > 0) {
    let best = future[0];
    let minDiff = Infinity;
    for (const g of future) {
      const d = g.expirationDate instanceof Date ? g.expirationDate : new Date(g.expirationDate);
      const diff = d.getTime() - targetTime;
      if (diff < minDiff) {
        minDiff = diff;
        best = g;
      }
    }
    return best;
  }
  // Fallback: closest overall (all expirations are in the past)
  let closest = options[0];
  let minDiff = Infinity;
  for (const g of options) {
    const d = g.expirationDate instanceof Date ? g.expirationDate : new Date(g.expirationDate);
    const diff = Math.abs(d.getTime() - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      closest = g;
    }
  }
  return closest;
}

// Try to fetch live options from Yahoo Finance; returns null on failure or empty data
// Always fetches full chain first so we pick from Yahoo's actual expiration dates (avoids
// Yahoo's "date" param returning "nearest" which can be wrong, e.g. Jan 30 when user asked Feb 6).
async function fetchFromYahooOptions(
  underlying: string,
  expiration: string,
  stockPrice: number,
  daysToExp: number
): Promise<{
  optionChain: { strike: number; call: OptionContractData | null; put: OptionContractData | null }[];
  actualExpiration: string;
} | null> {
  const expTarget = expiration.slice(0, 10);
  const parseResult = (result: unknown) => {
    const options = (result as { options?: YahooOptionGroup[] }).options;
    if (!options?.length) return null;
    return findExpirationGroup(options, expTarget);
  };

  try {
    // 1. Fetch full chain first (no date) - Yahoo returns expirationDates + options (may be single nearest)
    let result = await yahooFinance.options(underlying);
    const rawExpDates = (result as { expirationDates?: (Date | string)[] }).expirationDates ?? [];
    let rawOptions = (result as { options?: YahooOptionGroup[] }).options ?? [];
    const expDateStrs = rawExpDates.map((d) => toDateString(d instanceof Date ? d : new Date(d)));
    let group: YahooOptionGroup | null = null;
    // Yahoo returns options.length=1 (nearest only) but expirationDates has all - use expirationDates to pick best, then re-fetch
    // Use midnight UTC to match Yahoo's date= Unix timestamp (e.g. date=1771545600 = 2026-02-20T00:00:00Z)
    if (rawOptions.length <= 1 && expDateStrs.length > 0) {
      const targetTime = new Date(expTarget + "T00:00:00Z").getTime();
      const future = expDateStrs.filter((s) => new Date(s + "T00:00:00Z").getTime() >= targetTime);
      const bestDate =
        future.length > 0
          ? future.reduce((a, b) =>
              Math.abs(new Date(a + "T00:00:00Z").getTime() - targetTime) <
              Math.abs(new Date(b + "T00:00:00Z").getTime() - targetTime)
                ? a
                : b
            )
          : expDateStrs.reduce((a, b) =>
              Math.abs(new Date(a + "T00:00:00Z").getTime() - targetTime) <
              Math.abs(new Date(b + "T00:00:00Z").getTime() - targetTime)
                ? a
                : b
            );
      result = await yahooFinance.options(underlying, { date: new Date(bestDate + "T00:00:00Z") });
      rawOptions = (result as { options?: YahooOptionGroup[] }).options ?? [];
      group = rawOptions?.[0] ?? null;
    } else if (rawOptions.length > 1) {
      group = findExpirationGroup(rawOptions, expTarget);
    } else {
      group = parseResult(result);
    }
    if (!group || ((group.calls?.length ?? 0) === 0 && (group.puts?.length ?? 0) === 0)) return null;
    const calls = group.calls ?? [];
    const puts = group.puts ?? [];
    if (calls.length === 0 && puts.length === 0) return null;

    const mapContract = (c: YahooCallOrPut, contractType: "call" | "put"): OptionContractData => {
      const strikePrice = c.strike;
      const premium = c.lastPrice > 0 ? c.lastPrice : ((c.bid ?? 0) + (c.ask ?? 0)) / 2 || 0;
      const bid = (c.bid != null && c.bid > 0) ? c.bid : premium;
      const ask = (c.ask != null && c.ask > 0) ? c.ask : premium;
      // Yahoo IV can be decimal (0.35) or already % (35); treat < 2 as decimal
      const ivRaw = c.impliedVolatility ?? 0;
      const iv = ivRaw <= 2 ? ivRaw : ivRaw / 100;
      const expDateStr = c.expiration instanceof Date
        ? c.expiration.toISOString().slice(0, 10)
        : expiration;
      const probOtm = probabilityCalledAway(stockPrice, strikePrice, daysToExp, iv); // P(S > K) at exp
      const probCalledAway = contractType === "call" ? probOtm : undefined;
      const probExpireOtm = contractType === "put" ? probOtm : undefined;
      const rationale = generateRationale(stockPrice, strikePrice, contractType, iv, daysToExp, probCalledAway);

      return {
        ticker: `O:${underlying}`,
        yahoo_symbol: c.contractSymbol,
        strike_price: strikePrice,
        expiration_date: expDateStr,
        contract_type: contractType,
        premium,
        totalPremium: premium * 100,
        last_quote: { bid, ask },
        volume: c.volume ?? 0,
        open_interest: c.openInterest ?? 0,
        implied_volatility: Math.round((iv <= 2 ? iv * 100 : iv) * 10) / 10,
        rationale,
        probability_called_away: probCalledAway,
        probability_expire_otm: probExpireOtm,
        dataSource: "yahoo",
      };
    };

    const callList: OptionContractData[] = calls.map((c) => mapContract(c, "call"));
    const putList: OptionContractData[] = puts.map((p) => mapContract(p, "put"));

    const allStrikes = new Set<number>();
    callList.forEach((c) => allStrikes.add(c.strike_price));
    putList.forEach((p) => allStrikes.add(p.strike_price));
    const strikes = Array.from(allStrikes).sort((a, b) => a - b);

    const optionChain = strikes.map((strike) => ({
      strike,
      call: callList.find((c) => c.strike_price === strike) ?? null,
      put: putList.find((p) => p.strike_price === strike) ?? null,
    }));

    const actualExpiration =
      group.expirationDate instanceof Date
        ? group.expirationDate.toISOString().slice(0, 10)
        : expiration;

    return { optionChain, actualExpiration };
  } catch (e) {
    console.error(`${OPTIONS_LOG} fetchFromYahooOptions failed:`, e);
    return null;
  }
}

/** Same contract as xfinance-strategy `GET /api/options`. */
export async function getStrategyOptionsChain(requestUrl: string): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(requestUrl);
    const underlyingResult = parseUnderlying(searchParams.get("underlying"));
    if (!underlyingResult.ok) {
      return NextResponse.json({ error: underlyingResult.error }, { status: underlyingResult.status });
    }
    const underlying = underlyingResult.value;

    const expirationParam = searchParams.get("expiration");
    if (!expirationParam) {
      return NextResponse.json(
        { error: "expiration is required" },
        { status: 400 }
      );
    }

    const expiration = normalizeExpiration(expirationParam);
    const expirationCheck = validateNormalizedExpiration(expiration);
    if (!expirationCheck.ok) {
      return NextResponse.json({ error: expirationCheck.error }, { status: expirationCheck.status });
    }

    const strikeResult = parseStrike(searchParams.get("strike"));
    if (!strikeResult.ok) {
      return NextResponse.json({ error: strikeResult.error }, { status: strikeResult.status });
    }
    const targetStrike = strikeResult.value;

    // Get current stock price
    let stockPrice = targetStrike;
    try {
      const quote = await yahooFinance.quote(underlying);
      stockPrice = quote.regularMarketPrice || targetStrike;
    } catch {
      // Fallback to strike
    }

    const expDate = new Date(expiration + "T00:00:00Z");
    const today = new Date();
    const daysToExp = Math.max(
      1,
      Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Try Yahoo live options first; fall back to synthetic on failure or empty
    const yahooResult = await fetchFromYahooOptions(underlying, expiration, stockPrice, daysToExp);

    if (yahooResult && yahooResult.optionChain.length > 0) {
      return NextResponse.json({
        underlying,
        expiration: yahooResult.actualExpiration,
        requestedExpiration: expiration,
        targetStrike,
        stockPrice,
        daysToExpiration: daysToExp,
        strikeTolerance: targetStrike * 0.15,
        totalCalls: yahooResult.optionChain.filter((r) => r.call).length,
        totalPuts: yahooResult.optionChain.filter((r) => r.put).length,
        optionChain: yahooResult.optionChain,
        dataSource: "yahoo",
        note:
          yahooResult.actualExpiration !== expiration
            ? `Showing options expiring ${yahooResult.actualExpiration} (closest to requested date).`
            : "Live data from Yahoo Finance. Prices may be delayed.",
      });
    }

    // Fallback: synthetic option chain
    const [callsResult, putsResult] = await Promise.all([
      fetchOptionsForType(underlying, expiration, targetStrike, "call", stockPrice, daysToExp),
      fetchOptionsForType(underlying, expiration, targetStrike, "put", stockPrice, daysToExp),
    ]);

    const calls = callsResult.options;
    const puts = putsResult.options;

    const allStrikes = new Set<number>();
    calls.forEach((c: OptionContractData) => allStrikes.add(c.strike_price));
    puts.forEach((p: OptionContractData) => allStrikes.add(p.strike_price));
    const strikes = Array.from(allStrikes).sort((a, b) => a - b);

    const optionChain = strikes.map((strike) => {
      const call = calls.find((c: OptionContractData) => c.strike_price === strike);
      const put = puts.find((p: OptionContractData) => p.strike_price === strike);
      return {
        strike,
        call: call || null,
        put: put || null,
      };
    });

    const actualExpiration = calls[0]?.expiration_date || puts[0]?.expiration_date || expiration;

    return NextResponse.json({
      underlying,
      expiration: actualExpiration,
      requestedExpiration: expiration,
      targetStrike,
      stockPrice,
      daysToExpiration: daysToExp,
      strikeTolerance: targetStrike * 0.15,
      totalCalls: calls.length,
      totalPuts: puts.length,
      optionChain,
      dataSource: "synthetic",
      note: "Premiums are modeled (no live options feed). Actual market prices will vary.",
    });
  } catch (error) {
    console.error("Error fetching options:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
