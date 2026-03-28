export type OptionLegType = "call" | "put";
export type OptionLegSide = "long" | "short";

export type OptionsPayoffLeg = {
  id: string;
  type: OptionLegType;
  strike: number;
  premium: number;
  quantity: number;
  side: OptionLegSide;
};

export type PayoffPoint = {
  underlyingPrice: number;
  payoff: number;
};

export type BuildPayoffSeriesOptions = {
  pointCount?: number;
  minPrice?: number;
  maxPrice?: number;
};

const CONTRACT_MULTIPLIER = 100;
const DEFAULT_POINT_COUNT = 220;
const MIN_SERIES_PRICE = 0;

function toMoney(value: number): number {
  return Number(value.toFixed(2));
}

function intrinsicValue(type: OptionLegType, strike: number, underlyingPrice: number): number {
  if (type === "call") {
    return Math.max(underlyingPrice - strike, 0);
  }
  return Math.max(strike - underlyingPrice, 0);
}

export function calculateLegPayoffAtExpiration(leg: OptionsPayoffLeg, underlyingPrice: number): number {
  const intrinsic = intrinsicValue(leg.type, leg.strike, underlyingPrice);
  const perSharePayoff = leg.side === "long" ? intrinsic - leg.premium : leg.premium - intrinsic;
  return perSharePayoff * leg.quantity * CONTRACT_MULTIPLIER;
}

export function calculateNetPayoffAtExpiration(legs: OptionsPayoffLeg[], underlyingPrice: number): number {
  return legs.reduce((acc, leg) => acc + calculateLegPayoffAtExpiration(leg, underlyingPrice), 0);
}

function resolveSeriesDomain(
  legs: OptionsPayoffLeg[],
  currentPrice: number,
  minPrice?: number,
  maxPrice?: number
): { min: number; max: number } {
  const strikes = legs.map((leg) => leg.strike).filter((value) => Number.isFinite(value) && value > 0);
  const strikeMin = strikes.length ? Math.min(...strikes) : currentPrice;
  const strikeMax = strikes.length ? Math.max(...strikes) : currentPrice;
  const centerPrice = Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : (strikeMin + strikeMax) / 2 || 100;

  const autoMin = Math.max(MIN_SERIES_PRICE, Math.min(strikeMin * 0.7, centerPrice * 0.7));
  const autoMax = Math.max(autoMin + 1, Math.max(strikeMax * 1.3, centerPrice * 1.3));

  const resolvedMin = minPrice != null && Number.isFinite(minPrice) ? Math.max(MIN_SERIES_PRICE, minPrice) : autoMin;
  const resolvedMax = maxPrice != null && Number.isFinite(maxPrice) ? Math.max(resolvedMin + 1, maxPrice) : autoMax;
  return { min: resolvedMin, max: resolvedMax };
}

export function buildPayoffSeries(
  legs: OptionsPayoffLeg[],
  currentPrice: number,
  options: BuildPayoffSeriesOptions = {}
): PayoffPoint[] {
  const pointCount = Math.max(30, options.pointCount ?? DEFAULT_POINT_COUNT);
  const domain = resolveSeriesDomain(legs, currentPrice, options.minPrice, options.maxPrice);
  const step = (domain.max - domain.min) / pointCount;

  const points: PayoffPoint[] = [];
  for (let i = 0; i <= pointCount; i += 1) {
    const underlyingPrice = domain.min + step * i;
    points.push({
      underlyingPrice: toMoney(underlyingPrice),
      payoff: toMoney(calculateNetPayoffAtExpiration(legs, underlyingPrice))
    });
  }
  return points;
}

export function getUniqueStrikes(legs: OptionsPayoffLeg[]): number[] {
  return Array.from(new Set(legs.map((leg) => leg.strike)))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
}

export function estimateBreakevenPrices(points: PayoffPoint[], epsilon = 1e-8): number[] {
  if (points.length < 2) {
    return [];
  }

  const breakevens: number[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const left = points[index];
    const right = points[index + 1];
    if (!left || !right) {
      continue;
    }

    if (Math.abs(left.payoff) <= epsilon) {
      breakevens.push(left.underlyingPrice);
      continue;
    }

    if (left.payoff * right.payoff < 0) {
      const slope = right.payoff - left.payoff;
      if (Math.abs(slope) <= epsilon) {
        continue;
      }
      const ratio = -left.payoff / slope;
      const interpolated = left.underlyingPrice + ratio * (right.underlyingPrice - left.underlyingPrice);
      breakevens.push(interpolated);
    }
  }

  return Array.from(new Set(breakevens.map((value) => toMoney(value)))).sort((a, b) => a - b);
}
