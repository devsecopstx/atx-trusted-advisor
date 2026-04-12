"use client";

import { formatUsdWhole } from "@/lib/portfolio-overview-metrics";

import type { PortfoliosHeroTopHolding } from "./portfolios-hero-left-column";

type Props = {
  topHoldings: PortfoliosHeroTopHolding[];
};

export function PortfoliosMiniHoldingsGlance({ topHoldings }: Props) {
  return (
    <div className="portfolios-mini-holdings xf-noise-overlay mt-3 rounded-lg border border-white/10 bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="m-0 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--xf-text-200)]">
          Top book
        </h3>
      </div>
      <p className="mb-1 text-[0.65rem] text-[var(--xf-text-300)]">Largest stock book (workspace)</p>
      {topHoldings.length === 0 ? (
        <p className="m-0 text-xs text-[var(--xf-text-300)]">Add positions from Portfolio.</p>
      ) : (
        <ul className="m-0 list-none space-y-0.5 p-0">
          {topHoldings.map((h) => (
            <li
              key={h.symbol}
              className="flex justify-between gap-2 font-mono text-xs tabular-nums text-[var(--xf-text-100)]"
            >
              <span>{h.symbol}</span>
              <span className="text-[var(--xf-text-300)]">{formatUsdWhole(h.bookUsd)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
