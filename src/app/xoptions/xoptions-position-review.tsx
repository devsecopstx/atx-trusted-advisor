"use client";

import type { ReactNode } from "react";

import { XoptionsOrderPreviewCard } from "@/app/xoptions/xoptions-order-preview-card";
import type { StrategyChoiceId } from "@/app/xoptions/xoptions-strategy-choice-panels";
import { strategyShortLabel } from "@/app/xoptions/xoptions-strategy-choice-panels";
import {
  buildHnwiBreakevenMetricValue,
  buildHnwiExecutiveAdvisorNote,
  buildHnwiOrderSummaryHeadline,
  buildHnwiOrderSummaryMetaLine,
  buildHnwiTradeThesis,
  type XoptionsHnwiReviewCopyInput
} from "@/lib/xoptions/xoptions-hnwi-review-copy";
import {
  XOPTIONS_REVIEW_ORDER_FOOTNOTE,
  type XoptionsOpeningAction,
  type XoptionsOrderReview
} from "@/lib/xoptions/xoptions-order-preview";
import type {
  XoptionsPortfolioContext,
  XoptionsReviewAuditTrail,
  XoptionsReviewSummary,
  XoptionsRiskAlert,
  XoptionsWhatIfAssigned
} from "@/lib/xoptions/xoptions-review-types";

type MetricCardProps = {
  label: string;
  title: string;
  children: ReactNode;
  valueClassName?: string;
  highlight?: "gain" | "warning" | "danger" | "default";
};

function MetricCard({ label, title, children, valueClassName, highlight = "default" }: MetricCardProps) {
  const highlightClass =
    highlight === "gain"
      ? "xoptions-hnwi-report__metric-value--gain"
      : highlight === "warning"
        ? "xoptions-hnwi-report__metric-value--warning"
        : highlight === "danger"
          ? "xoptions-hnwi-report__metric-value--danger"
          : "";
  return (
    <div className="xoptions-hnwi-report__metric-card">
      <span className="xoptions-hnwi-report__metric-label" title={title}>
        {label}
      </span>
      <span
        className={`xoptions-hnwi-report__metric-value font-semibold tabular-nums ${highlightClass} ${valueClassName ?? ""}`}
      >
        {children}
      </span>
    </div>
  );
}

function OtmSemiGauge({ percent }: { percent: number | null }) {
  const p = percent == null ? null : Math.min(100, Math.max(0, percent));
  return (
    <svg className="xoptions-review-order__gauge-svg" width="56" height="32" viewBox="0 0 100 56" aria-hidden>
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
        {p != null ? <div className="xoptions-review-order__risk-meter-fill" style={{ width: `${p}%` }} /> : null}
      </div>
      <span className="xoptions-review-order__risk-meter-label">{p != null ? `${Math.round(p)} / 100` : "—"}</span>
    </div>
  );
}

function usd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function buildPortfolioImpactNotes(input: {
  underlying: string;
  portfolioContext: XoptionsPortfolioContext | null | undefined;
  holdingSharesForSymbol: number | null;
  portfolioApproxValue: number | null;
}): string[] {
  const notes: string[] = [];
  const sym = input.underlying.trim().toUpperCase();
  const ctx = input.portfolioContext;
  if (ctx?.cashBalanceUsd != null && Number.isFinite(ctx.cashBalanceUsd)) {
    notes.push(
      `${ctx.portfolioName?.trim() ? `${ctx.portfolioName.trim()} ` : ""}cash available: ${usd(ctx.cashBalanceUsd)}.`
    );
  }
  if (ctx?.symbolMarketValueUsd != null && ctx.symbolPctOfPortfolio != null) {
    notes.push(
      `${sym} exposure: ${usd(ctx.symbolMarketValueUsd)} (${ctx.symbolPctOfPortfolio.toFixed(1)}% of tracked book value).`
    );
  } else if (input.holdingSharesForSymbol != null && input.holdingSharesForSymbol > 0) {
    notes.push(`${sym} stock position: ${input.holdingSharesForSymbol.toLocaleString()} shares in workspace.`);
  } else {
    notes.push(`No ${sym} stock position in the active workspace book.`);
  }
  if (input.portfolioApproxValue != null && input.portfolioApproxValue > 0) {
    notes.push(`Reference book value (top holdings): ${usd(input.portfolioApproxValue)}.`);
  }
  return notes;
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
  riskAlerts?: XoptionsRiskAlert[];
  whatIfAssigned?: XoptionsWhatIfAssigned | null;
  reviewSummary?: XoptionsReviewSummary | null;
  auditTrail?: XoptionsReviewAuditTrail | null;
  portfolioContext?: XoptionsPortfolioContext | null;
  outlook?: string | null;
  riskProfile?: string | null;
  payoffPreview?: ReactNode;
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
  side,
  riskAlerts = [],
  whatIfAssigned = null,
  reviewSummary = null,
  auditTrail = null,
  portfolioContext = null,
  outlook = null,
  riskProfile = null,
  payoffPreview = null
}: XoptionsPositionReviewProps) {
  const title = strategyLabel?.trim() || strategyShortLabel(strategyChoiceId) || "Single-leg option";
  const assignmentPct =
    reviewSummary?.assignmentProbabilityPercent ??
    (orderReview.probabilityOtmPercent != null
      ? Math.min(100, Math.max(0, 100 - orderReview.probabilityOtmPercent))
      : null);
  const assignmentElevated = assignmentPct != null && assignmentPct >= 35;
  const ivElevated = riskAlerts.some((a) => a.id === "iv_rank_high");
  const securedNotionalUsd =
    openingAction === "sell_to_open" && strike > 0 ? strike * Math.max(1, quantity) * 100 : null;

  const hnwiInput: XoptionsHnwiReviewCopyInput = {
    symbol: underlying,
    side,
    openingAction,
    strike,
    expirationYyyyMmDd,
    quantity,
    limitPricePerShare,
    orderReview,
    strategyLabel: title,
    outlookSlug: outlook ?? auditTrail?.outlook ?? null,
    riskProfileSlug: riskProfile ?? auditTrail?.riskProfile ?? null,
    portfolioName: portfolioContext?.portfolioName ?? null,
    cashBalanceUsd: portfolioContext?.cashBalanceUsd ?? null,
    securedNotionalUsd,
    impliedVolatilityElevated: ivElevated
  };

  const summaryHeadline = buildHnwiOrderSummaryHeadline(hnwiInput);
  const summaryMeta = buildHnwiOrderSummaryMetaLine(hnwiInput);
  const executiveNote = buildHnwiExecutiveAdvisorNote(hnwiInput);
  const tradeThesis = buildHnwiTradeThesis({
    strategyLabel: title,
    outlookSlug: hnwiInput.outlookSlug,
    riskProfileSlug: hnwiInput.riskProfileSlug,
    orderReview
  });

  const premiumLabel = openingAction === "sell_to_open" ? "Premium collected" : "Premium paid";
  const premiumValue = usd(orderReview.grossPremiumUsd);
  const annualizedYield =
    reviewSummary?.annualizedYieldPercent ?? orderReview.annualizedPremiumYieldPercent;
  const portfolioImpactNotes = buildPortfolioImpactNotes({
    underlying,
    portfolioContext,
    holdingSharesForSymbol,
    portfolioApproxValue
  });

  return (
    <article
      className="xoptions-hnwi-report"
      data-order-text-preview
      aria-label="HNWI order review report"
    >
      <section className="xoptions-hnwi-report__summary-card" aria-labelledby="xoptions-hnwi-summary-title">
        <h2 id="xoptions-hnwi-summary-title" className="xoptions-hnwi-report__summary-title">
          Order summary
        </h2>
        <p className="xoptions-hnwi-report__summary-headline whitespace-pre-line">{summaryHeadline}</p>
        <p className="xoptions-hnwi-report__summary-meta">{summaryMeta}</p>
      </section>

      <section className="xoptions-hnwi-report__advisor-note" aria-label="Executive advisor note">
        <h3 className="xoptions-hnwi-report__section-label">Executive advisor note</h3>
        <p className="xoptions-hnwi-report__advisor-copy">{executiveNote}</p>
      </section>

      <section className="xoptions-hnwi-report__metrics" aria-label="Key metrics">
        <h3 className="xoptions-hnwi-report__section-label">Key metrics</h3>
        <div className="xoptions-hnwi-report__metrics-grid">
          <MetricCard label={premiumLabel} title="Gross premium at limit" highlight="gain">
            {premiumValue}
          </MetricCard>
          <MetricCard label="Collateral required" title="Cash or stock secured notional">
            {orderReview.capitalAtRiskDisplay}
          </MetricCard>
          <MetricCard label="Breakeven" title="Breakeven at expiration with estimated POP">
            {buildHnwiBreakevenMetricValue(orderReview)}
          </MetricCard>
          <MetricCard label="Annualized premium yield" title="Premium yield on collateral, annualized">
            {annualizedYield != null ? `${annualizedYield.toFixed(1)}%` : "—"}
          </MetricCard>
          <MetricCard label="Probability of profit" title="Estimated POP at expiry" highlight="gain">
            <span className="inline-flex items-center gap-1">
              {orderReview.probabilityProfitDisplay}
              <OtmSemiGauge percent={orderReview.probabilityProfitPercent} />
            </span>
          </MetricCard>
          <MetricCard label="Delta impact" title="Illustrative dollar delta vs sample sleeve">
            <span className="block text-[0.72rem] leading-snug font-normal text-[var(--xf-text-300)]">
              {orderReview.samplePortfolioDeltaLine ?? "—"}
              {orderReview.dollarDeltaApproxUsd != null ? (
                <span className="mt-0.5 block font-mono text-[0.68rem] text-[var(--xf-text-400)]">
                  ≈ {usd(orderReview.dollarDeltaApproxUsd)}
                </span>
              ) : null}
            </span>
          </MetricCard>
          <MetricCard
            label="Max loss"
            title="Maximum structured loss for this opening"
            highlight={assignmentElevated && openingAction === "sell_to_open" ? "warning" : "default"}
          >
            {orderReview.maxLossDisplay}
          </MetricCard>
        </div>
      </section>

      <section className="xoptions-hnwi-report__risk" aria-label="Risk snapshot and portfolio impact">
        <h3 className="xoptions-hnwi-report__section-label">Risk snapshot &amp; portfolio impact</h3>
        <ul className="xoptions-hnwi-report__risk-list">
          {riskAlerts.map((alert) => (
            <li
              key={alert.id}
              className={`xoptions-hnwi-report__risk-item xoptions-hnwi-report__risk-item--${alert.severity}`}
            >
              <span className="xoptions-hnwi-report__risk-item-title">{alert.title}</span>
              <span className="xoptions-hnwi-report__risk-item-copy">{alert.plainEnglish}</span>
            </li>
          ))}
          {portfolioImpactNotes.map((note) => (
            <li key={note} className="xoptions-hnwi-report__risk-item xoptions-hnwi-report__risk-item--info">
              <span className="xoptions-hnwi-report__risk-item-copy">{note}</span>
            </li>
          ))}
          {whatIfAssigned ? (
            <li className="xoptions-hnwi-report__risk-item xoptions-hnwi-report__risk-item--info">
              <span className="xoptions-hnwi-report__risk-item-title">Assignment scenario</span>
              <span className="xoptions-hnwi-report__risk-item-copy">{whatIfAssigned.narrative}</span>
            </li>
          ) : null}
        </ul>
      </section>

      <section className="xoptions-hnwi-report__detail" aria-labelledby="xoptions-hnwi-detail-title">
        <h3 id="xoptions-hnwi-detail-title" className="xoptions-hnwi-report__section-label">
          Detailed position review
        </h3>
        <p className="xoptions-hnwi-report__strategy-name">{title}</p>
        <p
          className="xoptions-broker-ticket-line mb-0 font-mono text-[0.72rem] leading-snug text-[var(--xf-text-300)]"
          title="Broker-style opening summary — informational only"
        >
          {orderReview.brokerTicketLine}
        </p>

        <div className="xoptions-hnwi-report__thesis">
          <h4 className="xoptions-hnwi-report__subsection-label">Trade thesis</h4>
          <p className="m-0 text-[0.75rem] leading-relaxed text-[var(--xf-text-200)]">{tradeThesis}</p>
        </div>

        <div className="xoptions-position-review__grid xoptions-hnwi-report__detail-grid mt-3">
          <MetricCard label="Limit" title="Limit price per share">
            {orderReview.bidPerShareDisplay}
          </MetricCard>
          <MetricCard label="P(ITM)" title="Estimated probability of expiring in the money">
            <span className="inline-flex items-center gap-1">
              {assignmentPct != null ? `${assignmentPct}%` : "—"}
            </span>
          </MetricCard>
          <MetricCard label="P(OTM)" title="Estimated probability of expiring out of the money">
            <span className="inline-flex items-center gap-1">
              {orderReview.probabilityOtmDisplay}
              <OtmSemiGauge percent={orderReview.probabilityOtmPercent} />
            </span>
          </MetricCard>
          <MetricCard label="EV" title="Expected value not modeled in-app">
            {orderReview.expectedValueDisplay}
          </MetricCard>
          <div className="xoptions-position-review__metric xoptions-position-review__metric--capital col-span-2">
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

        {payoffPreview ? (
          <div className="xoptions-hnwi-report__payoff mt-3" aria-label="Payoff preview">
            {payoffPreview}
          </div>
        ) : null}

        {taxEducationEnabled ? (
          <ul className="xoptions-position-review__tax mt-3 list-disc space-y-1 border-t border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] pt-2 pl-4 text-[0.62rem] leading-relaxed text-[var(--xf-text-400)]">
            <li>Qualified covered-call rules can affect holding period; not evaluated here.</li>
            <li>LEAPs vs short-dated: character and timing differ; custodian reports govern.</li>
            <li>Wash-sale: offsetting stock/options within the window can disallow losses.</li>
            <li>Section 1256: most single-stock options are not 1256; index products may differ.</li>
          </ul>
        ) : null}

        {auditTrail ? (
          <div className="xoptions-position-review__audit mt-3 border-t border-[color-mix(in_srgb,var(--xf-text-100)_10%,transparent)] pt-2 text-[0.62rem] text-[var(--xf-text-500)]">
            <p className="m-0 font-semibold uppercase tracking-[0.06em] text-[var(--xf-text-400)]">Audit trail</p>
            <p className="mt-1 mb-0">Generated {new Date(auditTrail.generatedAtUtc).toLocaleString()}</p>
            {auditTrail.outlook ? <p className="mt-1 mb-0">Outlook: {auditTrail.outlook}</p> : null}
            {auditTrail.riskProfile ? <p className="mt-1 mb-0">Risk profile: {auditTrail.riskProfile}</p> : null}
          </div>
        ) : null}

        <div className="xoptions-review-order__info mt-3">
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
      </section>

      <footer className="xoptions-hnwi-report__footnote">
        <p className="m-0 text-[0.65rem] leading-relaxed text-[var(--xf-text-500)]">{XOPTIONS_REVIEW_ORDER_FOOTNOTE}</p>
        <p className="mt-2 mb-0 text-[0.65rem] leading-relaxed text-[var(--xf-text-500)]">
          Not financial, tax, or legal advice. Options involve substantial risk of loss. Past performance is not
          indicative of future results. Consult your advisor.
        </p>
      </footer>
    </article>
  );
}
