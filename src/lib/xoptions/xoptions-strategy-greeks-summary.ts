import type { XoptionsOpeningAction } from "@/lib/xoptions/xoptions-order-preview";

export type StrategyLegGreeks = {
  delta: number;
  gamma: number;
  thetaPerDay: number;
  vegaPerOnePercentIv: number;
};

export type StrategyGreeksSummary = {
  netDeltaShares: number | null;
  netThetaDailyUsd: number | null;
  netVegaPerOnePercentIvUsd: number | null;
  netGammaPerShare: number | null;
  gammaRiskWarning: boolean;
};

export const STRATEGY_GREEKS_GAMMA_RISK_THRESHOLD = 0.05;

function parseContracts(quantity: string): number {
  const n = parseInt(quantity.trim(), 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function positionSign(openingAction: XoptionsOpeningAction): 1 | -1 {
  return openingAction === "buy_to_open" ? 1 : -1;
}

export function computeStrategyGreeksSummary(input: {
  legGreeks: StrategyLegGreeks | null | undefined;
  quantity: string;
  openingAction: XoptionsOpeningAction;
}): StrategyGreeksSummary | null {
  const g = input.legGreeks;
  if (!g) {
    return null;
  }
  const { delta, gamma, thetaPerDay, vegaPerOnePercentIv } = g;
  if (
    !Number.isFinite(delta) ||
    !Number.isFinite(gamma) ||
    !Number.isFinite(thetaPerDay) ||
    !Number.isFinite(vegaPerOnePercentIv)
  ) {
    return null;
  }

  const contracts = parseContracts(input.quantity);
  const multiplier = contracts * 100;
  const sign = positionSign(input.openingAction);

  const netDeltaShares = sign * delta * multiplier;
  const netThetaDailyUsd = sign * thetaPerDay * multiplier;
  const netVegaPerOnePercentIvUsd = sign * vegaPerOnePercentIv * multiplier;
  const netGammaPerShare = sign * gamma;

  return {
    netDeltaShares,
    netThetaDailyUsd,
    netVegaPerOnePercentIvUsd,
    netGammaPerShare,
    gammaRiskWarning: Math.abs(netGammaPerShare) > STRATEGY_GREEKS_GAMMA_RISK_THRESHOLD
  };
}

function formatSignedNumber(value: number, digits: number): string {
  const rounded = value.toFixed(digits);
  if (value > 0) {
    return `+${rounded}`;
  }
  return rounded;
}

export function formatStrategyNetDeltaShares(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return `${formatSignedNumber(value, 2)} sh`;
}

export function formatStrategyNetThetaDailyUsd(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(abs);
  if (value > 0) {
    return `+${formatted}/day`;
  }
  if (value < 0) {
    return `−${formatted}/day`;
  }
  return `${formatted}/day`;
}

export function formatStrategyNetVegaExposureUsd(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(abs);
  if (value > 0) {
    return `+${formatted} / 1% IV`;
  }
  if (value < 0) {
    return `−${formatted} / 1% IV`;
  }
  return `${formatted} / 1% IV`;
}
