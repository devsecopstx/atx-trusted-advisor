"use client";

import type { ReactNode } from "react";

import { XoptionsOrderPreviewCard } from "@/app/xoptions/xoptions-order-preview-card";
import type { StrategyChoiceId } from "@/app/xoptions/xoptions-strategy-choice-panels";
import { strategyShortLabel } from "@/app/xoptions/xoptions-strategy-choice-panels";
import type { XoptionsOpeningAction, XoptionsOrderReview } from "@/lib/xoptions/xoptions-order-preview";

type MetricProps = {
  label: string;
  title: string;
  children: ReactNode;
  valueClassName?: string;
};

function Metric({ label, title, children, valueClassName }: MetricProps) {
  return (
    <div className="xoptions-position-review__metric">
      <span className="xoptions-position-review__metric-label" title={title}>
        {label}
      </span>
      <span className={`xoptions-position-review__metric-value font-semibold tabular-nums ${valueClassName ?? ""}`}>
        {children}
      </span>
    </div>
  );
}

function OtmSemiGauge({ percent }: { percent: number | null }) {
  const p = percent == null ? null : Math.min(100, Math.max(0, percent));
  return (
    <svg
      className="xoptions-review-order__gauge-svg"
      width="56"
      height="32"
      viewBox="0 0 100 56"
      aria-hidden
    >
      <path
        d="M 12 48 A 38 38 0 0 1 88 48"
        fill="none"
        className="xoptions-review-order__gauge-track"
        strokeWidth="9"
        strokeLinecap="round"
        pathLength={100}
      />
      {p != null ? (
        <path
          d="M 12 48 A 38 38 0 0 1 88 48"
          fill="none"
          className="xoptions-review-order__gauge-fill"
          strokeWidth="9"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${p} ${100 - p}`}
        />
      ) : null}
    </svg>
  );
}

function RiskMeter({ score }: { score: number | null }) {
  const p = score == null ? null : Math.min(100, Math.max(0, score));
  return (
    <div className="xoptions-review-order__risk-meter" role="img" aria-label="Capital at risk vs reference portfolio">
      <div className="xoptions-review-order__risk-meter-track">
        {p != null ? (
          <div className="xoptions-review-order__risk-meter-fill" style={{ width: `${p}%` }} />
        ) : null}
      </div>
      <span className="xoptions-review-order__risk-meter-label">{p != null ? `${Math.round(p)} / 100` : "—"}</span>
    </div>
  );
}

type XoptionsPositionReviewProps = {
  orderReview: XoptionsOrderReview;
  underlying: string;
  strategyChoiceId: StrategyChoiceId | null;
  strategyLabel: string | null;
  openingAction: XoptionsOpeningAction;
  riskScorePercent: number | null;
  portfolioApproxValue: number | null;
  taxEducationEnabled: boolean;
  holdingSharesForSymbol: number | null;
  yahooOptionSymbol: string | null;
  strike: number;
  expirationYyyyMmDd: string;
  quantity: number;
  limitPricePerShare: number;
  side: "call" | "put";
};

export function XoptionsPositionReview({
  orderReview,
  underlying,
  strategyChoiceId,
  strategyLabel,
  openingAction,
  riskScorePercent,
  portfolioApproxValue,
  taxEducationEnabled,
  holdingSharesForSymbol,
  yahooOptionSymbol,
  strike,
  expirationYyyyMmDd,
  quantity,
  limitPricePerShare,
  side
}: XoptionsPositionReviewProps) {
  const title = strategyLabel?.trim() || strategyShortLabel(strategyChoiceId) || "Single-leg option";
  const pctRef =
    orderReview.maxLossUsd != null &&
    portfolioApproxValue != null &&
    portfolioApproxValue > 0
      ? ((orderReview.maxLossUsd / portfolioApproxValue) * 100).toFixed(2)
      : null;

  const riskLead =
    openingAction === "buy_to_open"
      ? `Risks ${orderReview.maxLossDisplay}${pctRef != null ? ` (${pctRef}% of reference portfolio)` : ""}. Loss capped at debit if the option expires worthless.`
      : `Collateral context: ${orderReview.capitalAtRiskDisplay}. Assignment and tail risks apply; not fully modeled here.`;

  return (
    <div
      className="xoptions-position-review rounded-md border border-[color-mix(in_srgb,var(--xf-xoptions-accent)_32%,transparent)] bg-[color-mix(in_srgb,var(--xf-xoptions-surface)_94%,var(--xf-bg-900))] p-3 shadow-[0_1px_0_color-mix(in_srgb,var(--xf-text-100)_8%,transparent)]"
      data-order-text-preview
    >
      <h3 className="xoptions-position-review__title m-0 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[color-mix(in_srgb,var(--xf-xoptions-accent)_85%,var(--xf-text-100))]">
        Position review
      </h3>

      <p
        className="xoptions-broker-ticket-line mt-2 mb-0 break-words font-mono text-[0.72rem] leading-snug text-[var(--xf-text-200)]"
        title="Broker-style opening summary — informational only"
      >
        {orderReview.brokerTicketLine}
      </p>

      <div
        className="xoptions-position-review__risk mt-2 rounded border border-[color-mix(in_srgb,var(--xf-warning-400)_40%,transparent)] bg-[color-mix(in_srgb,var(--xf-warning-400)_8%,transparent)] p-2 text-[0.68rem] leading-snug text-[var(--xf-text-200)]"
        role="status"
      >
        <p className="m-0 font-medium text-[var(--xf-text-100)]">Risk snapshot</p>
        <p className="mt-1 mb-0 text-[var(--xf-text-300)]">{riskLead}</p>
        {underlying ? (
          <p className="mt-1 mb-0 text-[0.62rem] text-[var(--xf-text-500)]">
            Equity tail (e.g. {underlying} → $0) is separate from option premium risk.
          </p>
        ) : null}
      </div>

      <p className="mt-3 mb-0 text-sm font-semibold text-[var(--xf-text-100)]">{title}</p>
      <p className="mt-1 mb-0 text-[0.72rem] leading-snug text-[var(--xf-text-400)]">{orderReview.strategyOneLiner}</p>

      <div className="xoptions-position-review__grid mt-3">
        <Metric label="Limit" title="Limit price per share for this preview" valueClassName="text-[var(--xf-text-100)]">
          {orderReview.bidPerShareDisplay}
        </Metric>
        <Metric
          label="Breakeven"
          title="Stock price at expiration where P/L crosses zero (model)"
          valueClassName="text-[var(--xf-text-100)]"
        >
          {orderReview.breakevenDisplay}
        </Metric>
        <Metric
          label="POP"
          title="Estimated probability of profit at expiry (risk-neutral; illustrative)"
          valueClassName="text-[var(--xf-gain-green)]"
        >
          <span className="inline-flex items-center gap-1">
            {orderReview.probabilityProfitDisplay}
            <OtmSemiGauge percent={orderReview.probabilityProfitPercent} />
          </span>
        </Metric>
        <Metric label="EV" title="Expected value not modeled in-app" valueClassName="text-[var(--xf-text-300)]">
          {orderReview.expectedValueDisplay}
        </Metric>
        <Metric
          label="Max loss"
          title="Maximum debit for long premium; short premium differs"
          valueClassName="text-[color-mix(in_srgb,var(--xf-danger-400)_90%,var(--xf-text-100))]"
        >
          {orderReview.maxLossDisplay}
        </Metric>
        <div className="xoptions-position-review__metric xoptions-position-review__metric--capital">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="xoptions-position-review__metric-label" title="Debit or secured notional">
              At risk
            </span>
            <span className="font-semibold tabular-nums text-[var(--xf-text-100)]">
              {orderReview.capitalAtRiskDisplay}
            </span>
          </div>
          <RiskMeter score={riskScorePercent} />
        </div>
      </div>

      <div className="xoptions-position-review__extra mt-3 space-y-2 border-t border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] pt-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[0.58rem] font-semibold uppercase tracking-[0.06em] text-[var(--xf-text-500)]" title="Annualized yield on premium vs secured notional">
            Ann. premium yield
          </span>
          <span className="font-semibold tabular-nums text-[var(--xf-text-200)]">
            {orderReview.annualizedPremiumYieldPercent != null
              ? `${orderReview.annualizedPremiumYieldPercent.toFixed(1)}%`
              : "—"}
          </span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <span
            className="text-[0.58rem] font-semibold uppercase tracking-[0.06em] text-[var(--xf-text-500)]"
            title="Versus a $250k sleeve in the same stock"
          >
            Delta impact
          </span>
          <span className="max-w-[16rem] text-right text-[0.65rem] leading-snug text-[var(--xf-text-300)]">
            {orderReview.samplePortfolioDeltaLine ?? "—"}
            {orderReview.dollarDeltaApproxUsd != null ? (
              <span className="mt-0.5 block font-mono text-[0.62rem] text-[var(--xf-text-400)]">
                ≈ {orderReview.dollarDeltaApproxUsd.toLocaleString("en-US", { style: "currency", currency: "USD" })}{" "}
                delta $
              </span>
            ) : null}
          </span>
        </div>
      </div>

      {taxEducationEnabled ? (
        <ul className="xoptions-position-review__tax mt-3 list-disc space-y-1 border-t border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] pt-2 pl-4 text-[0.62rem] leading-relaxed text-[var(--xf-text-400)]">
          <li>Qualified covered-call rules can affect holding period; not evaluated here.</li>
          <li>LEAPs vs short-dated: character and timing differ; custodian reports govern.</li>
          <li>Wash-sale: offsetting stock/options within the window can disallow losses.</li>
          <li>Section 1256: most single-stock options are not 1256; index products may differ.</li>
        </ul>
      ) : null}

      {holdingSharesForSymbol != null && holdingSharesForSymbol > 0 ? (
        <p className="mt-3 mb-0 text-[0.65rem] text-[var(--xf-text-400)]">
          Workspace: {holdingSharesForSymbol.toLocaleString()} sh {underlying}.
        </p>
      ) : (
        <p className="mt-3 mb-0 text-[0.65rem] text-[var(--xf-text-500)]">No stock position in workspace for {underlying}.</p>
      )}

      <div className="xoptions-review-order__info mt-3 border-t border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] pt-2">
        <XoptionsOrderPreviewCard
          symbol={underlying}
          strike={strike}
          expirationYyyyMmDd={expirationYyyyMmDd}
          quantity={quantity}
          optionSide={side}
          openingAction={openingAction}
          limitPricePerShare={limitPricePerShare}
          probabilityOtmPercent={orderReview.probabilityOtmPercent}
          strategyType={title}
          chainId={yahooOptionSymbol}
        />
      </div>
    </div>
  );
}
