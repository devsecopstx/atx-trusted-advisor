"use client";

import { formatUsdWhole } from "@/lib/portfolio-overview-metrics";
import { TickerIcon } from "@/components/ui/ticker-icon";

import type { PortfoliosHeroTopHolding } from "./portfolios-hero-left-column";

type Props = {
  topHoldings: PortfoliosHeroTopHolding[];
};

export function PortfoliosMiniHoldingsGlance({ topHoldings }: Props) {
  return (
    <div className="portfolios-mini-holdings xf-noise-overlay mt-3 rounded-3xl border border-[color-mix(in_srgb,var(--xf-gain-green)_10%,transparent)] bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)] p-3 transition-colors hover:border-[color-mix(in_srgb,var(--xf-gain-green)_30%,transparent)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="m-0 text-[0.68rem] font-semibold uppercase tracking-wider text-[var(--xf-gain-green)]">
          Top book
        </h3>
      </div>
      <p className="mb-1 text-[0.65rem] text-[var(--xf-text-300)]">Largest stock book (workspace)</p>
      {topHoldings.length === 0 ? (
        <p className="m-0 text-xs text-[var(--xf-text-300)]">Add positions from Portfolio.</p>
      ) : (
        <ul className="m-0 list-none space-y-1 p-0">
          {topHoldings.map((h) => (
            <li
              key={h.symbol}
              className="flex items-center justify-between gap-2 text-xs text-[var(--xf-text-100)]"
            >
              <span className="flex items-center gap-2">
                <TickerIcon symbol={h.symbol} size={20} />
                <span className="font-semibold">{h.symbol}</span>
              </span>
              <span className="font-mono tabular-nums text-[var(--xf-text-300)]">{formatUsdWhole(h.bookUsd)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
