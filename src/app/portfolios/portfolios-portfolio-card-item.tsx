"use client";

import { formatUsd2 } from "@/lib/portfolio-overview-metrics";
import type { WorkspaceDashboardAccountSlice } from "@/lib/workspace-dashboard-metrics";

import { buildPortfolioAllocationBarSlices } from "./portfolios-allocation-utils";
import type { WorkspacePortfolioRow } from "./portfolios-dashboard-client";

type Props = {
  row: WorkspacePortfolioRow;
  accountSlices: WorkspaceDashboardAccountSlice[];
  opening: boolean;
  onOpen: (portfolioId: string) => void;
};

export function PortfoliosPortfolioCardItem({ row, accountSlices, opening, onOpen }: Props) {
  const { total, barSlices } = buildPortfolioAllocationBarSlices(row.id, accountSlices);
  return (
    <button
      className="portfolios-portfolio-cards__card w-full rounded-lg border border-white/10 bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)] p-3 text-left transition hover:border-[color-mix(in_srgb,var(--xf-gain-green)_35%,transparent)] disabled:opacity-60"
      disabled={opening}
      type="button"
      onClick={() => onOpen(row.id)}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 truncate text-sm font-semibold text-[var(--xf-text-100)]">{row.name}</p>
          <p className="mt-0.5 text-xs text-[var(--xf-text-300)]">
            {row.isDefault ? <span className="text-[var(--xf-gain-green)]">Default</span> : row.kindLabel}
          </p>
        </div>
        <span className="shrink-0 font-mono text-sm tabular-nums text-[var(--xf-text-100)]">
          {formatUsd2(row.valueUsd)}
        </span>
      </div>
      {barSlices.length === 0 ? (
        <p className="m-0 text-xs text-[var(--xf-text-300)]">No linked accounts</p>
      ) : (
        <div className="portfolio-allocation portfolio-allocation--compact" role="presentation">
          <div
            className="portfolio-allocation__bar portfolio-allocation__bar--accounts portfolios-portfolio-cards__allocation-bar"
            role="presentation"
          >
            {barSlices.map((s) => (
              <div
                key={s.key}
                className="portfolio-allocation__segment"
                style={{ flexGrow: Math.max(s.percent, 0.01) }}
                title={`${s.label}: ${s.percent.toFixed(0)}% (${formatUsd2(s.valueUsd)})`}
              />
            ))}
          </div>
        </div>
      )}
      {total > 0 && barSlices.length > 1 ? (
        <p className="mt-1.5 text-[0.65rem] text-[var(--xf-text-300)]">
          {barSlices.length} accounts · book split shown above
        </p>
      ) : null}
      <p className="mt-2 text-xs text-[var(--xf-gain-green)]">{opening ? "Opening…" : "Open book →"}</p>
    </button>
  );
}
