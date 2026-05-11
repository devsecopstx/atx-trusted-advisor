"use client";

import {
    formatStrategyNetDeltaShares,
    formatStrategyNetThetaDailyUsd,
    formatStrategyNetVegaExposureUsd,
    type StrategyGreeksSummary
} from "@/lib/xoptions/xoptions-strategy-greeks-summary";

type XoptionsStrategyGreeksSummaryProps = {
  summary: StrategyGreeksSummary;
};

export function XoptionsStrategyGreeksSummary({ summary }: XoptionsStrategyGreeksSummaryProps) {
  return (
    <section
      className="xoptions-greeks-summary"
      aria-label="Strategy Greeks summary"
      data-gamma-risk={summary.gammaRiskWarning ? "true" : "false"}
    >
      <p className="xoptions-greeks-summary__title">Greek summary</p>
      <dl className="xoptions-greeks-summary__grid">
        <GreekSummaryItem label="Net delta" value={formatStrategyNetDeltaShares(summary.netDeltaShares)} />
        <GreekSummaryItem
          label="Net theta (daily income)"
          value={formatStrategyNetThetaDailyUsd(summary.netThetaDailyUsd)}
        />
        <GreekSummaryItem
          label="Net vega exposure"
          value={formatStrategyNetVegaExposureUsd(summary.netVegaPerOnePercentIvUsd)}
        />
      </dl>
      {summary.gammaRiskWarning ? (
        <p className="xoptions-greeks-summary__gamma-warning" role="status">
          Gamma risk: per-share gamma exceeds 0.05 — delta can shift quickly as spot moves.
        </p>
      ) : null}
    </section>
  );
}

function GreekSummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="xoptions-greeks-summary__item">
      <dt className="xoptions-greeks-summary__label">{label}</dt>
      <dd className="xoptions-greeks-summary__value">{value}</dd>
    </div>
  );
}
