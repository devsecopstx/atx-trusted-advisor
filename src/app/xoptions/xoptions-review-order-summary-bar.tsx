"use client";

type XoptionsReviewOrderSummaryBarProps = {
  bidDisplay: string;
  beDisplay: string;
  probDisplay: string;
  probPercent: number | null;
};

function OtmSemiGauge({ percent }: { percent: number | null }) {
  const p = percent == null ? null : Math.min(100, Math.max(0, percent));
  return (
    <svg
      className="xoptions-review-order__gauge-svg"
      width="72"
      height="40"
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

export function XoptionsReviewOrderSummaryBar({
  bidDisplay,
  beDisplay,
  probDisplay,
  probPercent
}: XoptionsReviewOrderSummaryBarProps) {
  return (
    <div className="xoptions-review-order__bar">
      <div className="xoptions-review-order__metric">
        <span className="xoptions-review-order__metric-label">Limit (bid)</span>
        <span className="xoptions-review-order__metric-value xoptions-review-order__metric-value--bid">
          {bidDisplay}
        </span>
      </div>
      <div className="xoptions-review-order__metric">
        <span className="xoptions-review-order__metric-label">Breakeven (BE)</span>
        <span className="xoptions-review-order__metric-value">{beDisplay}</span>
      </div>
      <div className="xoptions-review-order__metric xoptions-review-order__metric--otm">
        <span className="xoptions-review-order__metric-label">Probability of being OTM</span>
        <div className="xoptions-review-order__otm-row">
          <span className="xoptions-review-order__metric-value">{probDisplay}</span>
          <OtmSemiGauge percent={probPercent} />
        </div>
      </div>
    </div>
  );
}
