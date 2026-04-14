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
  onAskAdvisor: (row: WorkspacePortfolioRow) => void;
};

export function PortfoliosPortfolioCardItem({ row, accountSlices, opening, onOpen, onAskAdvisor }: Props) {
  const { total, barSlices } = buildPortfolioAllocationBarSlices(row.id, accountSlices);
  const cardClass = [
    "portfolios-portfolio-cards__card",
    "flex min-h-[8.75rem] w-full flex-col rounded-lg border bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)] p-3 text-left transition-[border-color,box-shadow,transform] duration-150",
    "hover:border-[color-mix(in_srgb,var(--xf-tenant-accent,var(--xf-xoptions-accent))_32%,transparent)] hover:shadow-md hover:-translate-y-px",
    row.isDefault ? "portfolios-portfolio-cards__card--default border-white/10" : "border-white/10"
  ].join(" ");
  return (
    <div className={cardClass} style={opening ? { opacity: 0.65 } : undefined}>
      <div className="mb-2 flex flex-1 flex-col gap-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-sm font-semibold text-[var(--xf-text-100)]" title={row.name}>
              {row.name}
            </p>
            <p className="mt-0.5 text-xs text-[var(--xf-text-300)]">
              {row.isDefault ? (
                <span className="font-semibold text-[color:var(--xf-tenant-accent,var(--xf-xoptions-accent))]">
                  Default
                </span>
              ) : (
                row.kindLabel
              )}
            </p>
          </div>
          <span className="shrink-0 font-mono text-sm tabular-nums text-[var(--xf-text-100)]">
            {formatUsd2(row.valueUsd)}
          </span>
        </div>
      </div>
      <div className="mt-auto">
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
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            className="m-0 border-0 bg-transparent p-0 text-left text-xs font-medium text-[color:var(--xf-tenant-accent,var(--xf-xoptions-accent))] hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
            disabled={opening}
            type="button"
            onClick={() => onOpen(row.id)}
          >
            {opening ? "Opening…" : "Open book →"}
          </button>
          <button
            className="m-0 border-0 bg-transparent p-0 text-left text-xs font-medium text-[color:var(--xf-tenant-accent,var(--xf-xoptions-accent))] hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
            disabled={opening}
            type="button"
            onClick={() => onAskAdvisor(row)}
          >
            Ask advisor
          </button>
        </div>
      </div>
    </div>
  );
}
