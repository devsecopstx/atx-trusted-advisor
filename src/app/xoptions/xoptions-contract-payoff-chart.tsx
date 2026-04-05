"use client";

import { useId, useMemo, useState } from "react";

import { europeanOptionPrice } from "@/lib/xoptions/xoptions-bs-greeks";
import type { XoptionsOpeningAction } from "@/lib/xoptions/xoptions-order-preview";
import { daysToExpirationUtc } from "@/lib/xoptions/xoptions-order-preview";

type Props = {
  side: "call" | "put";
  strike: number;
  premium: number;
  spot: number;
  ivPercent: number | null;
  expirationYyyyMmDd: string;
  openingAction?: XoptionsOpeningAction;
  /** From order review — e.g. capped upside for short calls. */
  cappedUpsideLabel?: string | null;
};

function pnlAtExpiry(
  side: "call" | "put",
  strike: number,
  premium: number,
  S: number,
  openingAction: XoptionsOpeningAction
): number {
  const intrinsic =
    side === "call" ? Math.max(0, S - strike) : Math.max(0, strike - S);
  if (openingAction === "buy_to_open") {
    return intrinsic - premium;
  }
  return premium - intrinsic;
}

function pnlMarkModel(
  side: "call" | "put",
  strike: number,
  premium: number,
  S: number,
  ivDecimal: number,
  T: number,
  openingAction: XoptionsOpeningAction
): number | null {
  const px = europeanOptionPrice({
    spot: S,
    strike,
    T,
    sigma: ivDecimal,
    riskFreeRate: 0.05,
    side
  });
  if (px == null) {
    return null;
  }
  if (openingAction === "buy_to_open") {
    return px - premium;
  }
  return premium - px;
}

export function XoptionsContractPayoffChart({
  side,
  strike,
  premium,
  spot,
  ivPercent,
  expirationYyyyMmDd,
  openingAction = "buy_to_open",
  cappedUpsideLabel = null
}: Props) {
  const gid = useId().replace(/:/g, "");
  const [view, setView] = useState<"expiry" | "mark">("expiry");

  const T = useMemo(
    () => Math.max(daysToExpirationUtc(expirationYyyyMmDd), 1) / 365,
    [expirationYyyyMmDd]
  );
  const ivDecimal = ivPercent != null && ivPercent > 0 ? ivPercent / 100 : null;

  if (!Number.isFinite(strike) || strike <= 0 || !Number.isFinite(premium) || premium < 0) {
    return (
      <div className="xoptions-contract-payoff__empty text-xs text-[var(--xf-text-400)]">
        Select a strike to preview payoff.
      </div>
    );
  }

  const sMax = Math.max(strike * 1.35, spot * 1.25, strike + 1);
  const sMin = Math.max(0, Math.min(strike * 0.65, spot * 0.75));
  const steps = 56;
  const pts: { s: number; y: number }[] = [];
  let pMin = 0;
  let pMax = 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const S = sMin + t * (sMax - sMin);
    let y: number | null;
    if (view === "expiry") {
      y = pnlAtExpiry(side, strike, premium, S, openingAction);
    } else if (ivDecimal != null) {
      y = pnlMarkModel(side, strike, premium, S, ivDecimal, T, openingAction);
    } else {
      y = null;
    }
    if (y == null || !Number.isFinite(y)) {
      continue;
    }
    pts.push({ s: S, y });
    if (y < pMin) pMin = y;
    if (y > pMax) pMax = y;
  }
  if (pts.length === 0) {
    return (
      <div className="xoptions-contract-payoff__empty text-xs text-[var(--xf-text-400)]">
        Not enough data to plot this view.
      </div>
    );
  }
  const pad = Math.max(Math.abs(pMin), Math.abs(pMax), premium) * 0.12;
  pMin -= pad;
  pMax += pad;

  const viewBoxW = 100;
  const viewBoxH = 58;
  const toX = (s: number) => 8 + ((s - sMin) / (sMax - sMin)) * (viewBoxW - 16);
  const toY = (pnl: number) => 8 + (1 - (pnl - pMin) / (pMax - pMin)) * (viewBoxH - 16);

  const lineD = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(p.s).toFixed(2)} ${toY(p.y).toFixed(2)}`)
    .join(" ");

  const y0 = toY(0);
  const be =
    openingAction === "buy_to_open"
      ? side === "call"
        ? strike + premium
        : Math.max(0, strike - premium)
      : side === "call"
        ? strike + premium
        : Math.max(0, strike - premium);
  const pnlAtStrike = pnlAtExpiry(side, strike, premium, strike, openingAction);
  const maxY = pts.reduce((a, p) => (p.y > a.y ? p : a), pts[0]!);
  const minY = pts.reduce((a, p) => (p.y < a.y ? p : a), pts[0]!);

  const markDisabled = ivDecimal == null;

  return (
    <div className="xoptions-contract-payoff">
      <div className="xoptions-contract-payoff__toolbar mb-2 flex flex-wrap items-center gap-2" role="group" aria-label="Payoff view">
        <button
          type="button"
          className={`xoptions-contract-payoff__toggle ${view === "expiry" ? "xoptions-contract-payoff__toggle--on" : ""}`}
          onClick={() => setView("expiry")}
          title="Intrinsic vs premium at expiration"
        >
          P/L at expiry
        </button>
        <button
          type="button"
          className={`xoptions-contract-payoff__toggle ${view === "mark" ? "xoptions-contract-payoff__toggle--on" : ""}`}
          onClick={() => setView("mark")}
          disabled={markDisabled}
          title={
            markDisabled
              ? "Mark view needs implied volatility from the chain"
              : "Modeled mark P/L vs spot (Black–Scholes; not live quote)"
          }
        >
          P/L today
        </button>
        {cappedUpsideLabel ? (
          <span className="ml-auto max-w-[14rem] text-right text-[0.58rem] font-semibold leading-tight text-[color-mix(in_srgb,var(--xf-xoptions-accent)_90%,var(--xf-text-100))]" title="Structured max gain scenario">
            {cappedUpsideLabel}
          </span>
        ) : null}
      </div>
      <svg
        className="xoptions-contract-payoff__svg xoptions-contract-payoff__svg--lg"
        viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
        aria-labelledby={`${gid}-title`}
        role="img"
      >
        <title id={`${gid}-title`}>
          {view === "expiry" ? "Profit and loss at expiration" : "Modeled mark P/L vs spot"} for{" "}
          {side} {openingAction === "sell_to_open" ? "short" : "long"} at strike {strike}
        </title>
        <defs>
          <linearGradient id={`${gid}-loss`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--xf-danger-400)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--xf-danger-400)" stopOpacity="0.06" />
          </linearGradient>
          <linearGradient id={`${gid}-gain`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--xf-gain-green)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--xf-gain-green)" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <line className="xoptions-contract-payoff__axis" x1="8" y1={y0} x2={viewBoxW - 8} y2={y0} />
        <line className="xoptions-contract-payoff__axis" x1="8" y1="8" x2="8" y2={viewBoxH - 8} />
        <line
          className="xoptions-contract-payoff__be-line"
          x1={toX(be)}
          y1="8"
          x2={toX(be)}
          y2={viewBoxH - 8}
        />
        <polygon
          fill={`url(#${gid}-loss)`}
          points={`8,${y0} ${viewBoxW - 8},${y0} ${viewBoxW - 8},${viewBoxH - 8} 8,${viewBoxH - 8}`}
          opacity={0.9}
        />
        <polygon
          fill={`url(#${gid}-gain)`}
          points={`8,8 ${viewBoxW - 8},8 ${viewBoxW - 8},${y0} 8,${y0}`}
          opacity={0.9}
        />
        <path className="xoptions-contract-payoff__curve" d={lineD} fill="none" strokeWidth="1.75" />
        <circle className="xoptions-contract-payoff__strike" cx={toX(strike)} cy={toY(pnlAtStrike)} r="2.2" />
        <circle className="xoptions-contract-payoff__be" cx={toX(be)} cy={y0} r="2" />
      </svg>
      <div className="xoptions-contract-payoff__axis-labels">
        <span>Spot</span>
        <span>P/L sh</span>
      </div>
      <div className="xoptions-strategy-legend mt-1 flex flex-wrap gap-x-3 gap-y-1">
        <span className="xoptions-strategy-legend__item">
          <span className="xoptions-strategy-legend__diamond" aria-hidden>
            ◇
          </span>{" "}
          Strike ${strike.toFixed(2)}
        </span>
        <span className="xoptions-strategy-legend__item">
          <span className="xoptions-strategy-legend__dot" aria-hidden>
            ●
          </span>{" "}
          Breakeven ${be.toFixed(2)}
        </span>
        <span className="xoptions-strategy-legend__item text-[var(--xf-text-400)]">
          Range max {maxY.y.toFixed(2)} / min {minY.y.toFixed(2)}
        </span>
      </div>
      <p className="xoptions-contract-payoff__hint mt-1 text-[0.65rem] text-[var(--xf-text-500)]">
        {view === "mark"
          ? "Mark view uses Black–Scholes with chain IV; not a live quote."
          : "Expiration view is intrinsic minus premium (long) or premium minus intrinsic (short)."}
      </p>
      <p className="xoptions-contract-payoff__hint mt-1">
        <a className="xoptions-text-link text-xs" href="/xstrategybuilder/strategy-options">
          How to read the graph
        </a>
      </p>
    </div>
  );
}
