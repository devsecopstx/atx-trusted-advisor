"use client";

import { PortfolioSymbolMark } from "@/app/portfolio/ui/portfolio-symbol-mark";
import type { WorkspaceTopBookMoverRow } from "@/lib/workspace-dashboard-metrics";

type Props = {
  topBookMovers: WorkspaceTopBookMoverRow[];
};

function toneClass(tone: WorkspaceTopBookMoverRow["tone"]): string {
  if (tone === "gain") {
    return "text-[var(--xf-gain-green)]";
  }
  if (tone === "loss") {
    return "text-red-300";
  }
  return "text-[var(--xf-text-300)]";
}

export function PortfoliosMiniHoldingsGlance({ topBookMovers }: Props) {
  return (
    <div className="portfolios-top-book-movers xf-noise-overlay mt-3 rounded-lg border border-white/10 bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)] p-3">
      <div className="mb-2">
        <h3 className="m-0 text-[0.78rem] font-semibold leading-snug text-[var(--xf-text-100)]">
          Your top and bottom movers
        </h3>
        <p className="mt-0.5 text-[0.65rem] leading-snug text-[var(--xf-text-300)]">
          Stock day move (Yahoo) × your aggregated share count across all books.
        </p>
      </div>

      {topBookMovers.length === 0 ? (
        <p className="m-0 text-xs text-[var(--xf-text-300)]">
          Add stock positions to see movers, or check back when quotes are available.
        </p>
      ) : (
        <div className="portfolios-top-book-movers__grid min-w-0">
          <div
            className="portfolios-top-book-movers__row portfolios-top-book-movers__row--head text-[0.62rem] font-medium uppercase tracking-wider text-[var(--xf-text-300)]"
            role="row"
          >
            <span role="columnheader">Symbol</span>
            <span className="text-right" role="columnheader">
              Today&apos;s gain/loss
            </span>
            <span className="text-right" role="columnheader">
              Last price
            </span>
          </div>
          {topBookMovers.map((row) => (
            <div key={row.symbol} className="portfolios-top-book-movers__row" role="row">
              <div className="flex min-w-0 items-center gap-2" role="cell">
                <PortfolioSymbolMark symbol={row.symbol} size={22} />
                <div className="min-w-0">
                  <div className="font-mono text-xs font-semibold tabular-nums text-[var(--xf-text-100)]">
                    {row.symbol}
                  </div>
                  <div
                    className="truncate text-[0.62rem] leading-snug text-[var(--xf-text-300)]"
                    title={row.companyName}
                  >
                    {row.companyName}
                  </div>
                </div>
              </div>
              <div
                className={`text-right font-mono text-xs tabular-nums whitespace-nowrap ${toneClass(row.tone)}`}
                role="cell"
              >
                {row.dayChangeUsdDisplay}
                {row.dayChangePercentDisplay !== "—" ? ` (${row.dayChangePercentDisplay})` : ""}
              </div>
              <div
                className="text-right font-mono text-xs tabular-nums text-[var(--xf-text-100)]"
                role="cell"
              >
                {row.lastPriceDisplay}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
