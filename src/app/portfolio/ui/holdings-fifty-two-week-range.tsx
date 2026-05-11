type HoldingsFiftyTwoWeekRangeProps = {
  low: number;
  high: number;
  last: number | null;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.min(1, Math.max(0, n));
}

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

export function HoldingsFiftyTwoWeekRange({ low, high, last }: HoldingsFiftyTwoWeekRangeProps) {
  const span = high - low;
  const markerPct =
    last != null && Number.isFinite(last) && span > 0 ? clamp01((last - low) / span) * 100 : null;

  return (
    <div className="portfolio-holdings-52w" title="52-week range (trailing)">
      <div className="portfolio-holdings-52w__track" aria-hidden>
        {markerPct != null ? (
          <span className="portfolio-holdings-52w__marker" style={{ left: `${markerPct}%` }} />
        ) : null}
      </div>
      <div className="portfolio-holdings-52w__labels">
        <span>{fmtUsd(low)}</span>
        <span>{fmtUsd(high)}</span>
      </div>
    </div>
  );
}
