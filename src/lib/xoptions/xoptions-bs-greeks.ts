/**
 * European Black–Scholes greeks (per share). For equity options, contract multiplier is ×100.
 */
import { normalCdf } from "@/lib/xoptions/xoptions-order-preview";

function normPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export type EuropeanOptionGreeks = {
  delta: number;
  gamma: number;
  /** Theta per calendar day (dollar per share per day, negative for long options typical). */
  thetaPerDay: number;
  /** Sensitivity to a 1 percentage-point move in IV (e.g. 35 → 36), per share. */
  vegaPerOnePercentIv: number;
};

/**
 * @param sigma Annualized volatility as decimal (e.g. 0.35)
 * @param T Time to expiration in years (>0)
 */
export function europeanOptionGreeks(input: {
  spot: number;
  strike: number;
  T: number;
  sigma: number;
  riskFreeRate: number;
  side: "call" | "put";
}): EuropeanOptionGreeks | null {
  const { spot: S, strike: K, riskFreeRate: r, sigma } = input;
  if (!Number.isFinite(S) || S <= 0 || !Number.isFinite(K) || K <= 0) {
    return null;
  }
  if (!Number.isFinite(sigma) || sigma <= 0) {
    return null;
  }
  const T = Math.max(input.T, 1 / (365 * 24 * 60));
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  const nd1 = normPDF(d1);
  const delta = input.side === "call" ? normalCdf(d1) : normalCdf(d1) - 1;
  const gamma = nd1 / (S * sigma * sqrtT);

  const vegaPerUnitSigma = S * nd1 * sqrtT;
  const vegaPerOnePercentIv = vegaPerUnitSigma * 0.01;

  const term1 = (-S * nd1 * sigma) / (2 * sqrtT);
  let thetaPerYear: number;
  if (input.side === "call") {
    thetaPerYear = term1 - r * K * Math.exp(-r * T) * normalCdf(d2);
  } else {
    thetaPerYear = term1 + r * K * Math.exp(-r * T) * normalCdf(-d2);
  }
  const thetaPerDay = thetaPerYear / 365;

  return {
    delta,
    gamma,
    thetaPerDay,
    vegaPerOnePercentIv
  };
}

/** Black–Scholes European option price per share. */
export function europeanOptionPrice(input: {
  spot: number;
  strike: number;
  T: number;
  sigma: number;
  riskFreeRate: number;
  side: "call" | "put";
}): number | null {
  const { spot: S, strike: K, T, sigma, riskFreeRate: r, side } = input;
  if (!Number.isFinite(S) || S <= 0 || !Number.isFinite(K) || K <= 0) {
    return null;
  }
  if (!Number.isFinite(sigma) || sigma <= 0 || !Number.isFinite(T) || T <= 0) {
    return null;
  }
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  if (side === "call") {
    return S * normalCdf(d1) - K * Math.exp(-r * T) * normalCdf(d2);
  }
  return K * Math.exp(-r * T) * normalCdf(-d2) - S * normalCdf(-d1);
}
