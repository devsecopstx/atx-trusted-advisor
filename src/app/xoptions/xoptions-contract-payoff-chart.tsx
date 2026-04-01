"use client";

import { useId } from "react";

type Props = {
  side: "call" | "put";
  strike: number;
  premium: number;
  spot: number;
};

/** Long option payoff at expiry (per share), for visualization only. */
function pnlAtExpiry(side: "call" | "put", strike: number, premium: number, S: number): number {
  if (side === "call") {
    return Math.max(0, S - strike) - premium;
  }
  return Math.max(0, strike - S) - premium;
}

export function XoptionsContractPayoffChart({ side, strike, premium, spot }: Props) {
  const gid = useId().replace(/:/g, "");

  if (!Number.isFinite(strike) || strike <= 0 || !Number.isFinite(premium) || premium < 0) {
    return (
      <div className="xoptions-contract-payoff__empty text-xs text-[var(--xf-text-400)]">
        Select a strike to preview payoff at expiration.
      </div>
    );
  }

  const sMax = Math.max(strike * 1.35, spot * 1.25, strike + 1);
  const sMin = Math.max(0, Math.min(strike * 0.65, spot * 0.75));
  const steps = 48;
  const pts: { s: number; y: number }[] = [];
  let pMin = 0;
  let pMax = 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const S = sMin + t * (sMax - sMin);
    const y = pnlAtExpiry(side, strike, premium, S);
    pts.push({ s: S, y });
    if (y < pMin) pMin = y;
    if (y > pMax) pMax = y;
  }
  const pad = Math.max(Math.abs(pMin), Math.abs(pMax), premium) * 0.12;
  pMin -= pad;
  pMax += pad;

  const toX = (s: number) => 6 + ((s - sMin) / (sMax - sMin)) * 88;
  const toY = (pnl: number) => 6 + (1 - (pnl - pMin) / (pMax - pMin)) * 40;

  const lineD = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(p.s).toFixed(2)} ${toY(p.y).toFixed(2)}`)
    .join(" ");

  const be =
    side === "call"
      ? strike + premium
      : Math.max(0, strike - premium);
  const y0 = toY(0);
  const pnlAtStrike = pnlAtExpiry(side, strike, premium, strike);

  return (
    <div className="xoptions-contract-payoff">
      <svg className="xoptions-contract-payoff__svg" viewBox="0 0 100 52" aria-hidden>
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
        <line className="xoptions-contract-payoff__axis" x1="6" y1={y0} x2="94" y2={y0} />
        <line className="xoptions-contract-payoff__axis" x1="6" y1="6" x2="6" y2="46" />
        <polygon
          fill={`url(#${gid}-loss)`}
          points={`6,${y0} 94,${y0} 94,46 6,46`}
          opacity={0.9}
        />
        <polygon
          fill={`url(#${gid}-gain)`}
          points={`6,6 94,6 94,${y0} 6,${y0}`}
          opacity={0.9}
        />
        <path className="xoptions-contract-payoff__curve" d={lineD} fill="none" strokeWidth="1.75" />
        <circle className="xoptions-contract-payoff__strike" cx={toX(strike)} cy={toY(pnlAtStrike)} r="2" />
        <circle className="xoptions-contract-payoff__be" cx={toX(be)} cy={y0} r="1.8" />
      </svg>
      <div className="xoptions-contract-payoff__axis-labels">
        <span>x: stock price</span>
        <span>y: profit / loss</span>
      </div>
      <div className="xoptions-strategy-legend mt-1">
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
      </div>
      <p className="xoptions-contract-payoff__hint mt-1">
        <a className="xoptions-text-link text-xs" href="/xstrategybuilder/strategy-options">
          How to read the graph
        </a>
      </p>
    </div>
  );
}
