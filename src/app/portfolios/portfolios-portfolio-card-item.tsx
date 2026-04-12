"use client";

import { formatUsd2 } from "@/lib/portfolio-overview-metrics";
import type { WorkspaceDashboardAccountSlice } from "@/lib/workspace-dashboard-metrics";

import { buildPortfolioAllocationBarSlices } from "./portfolios-allocation-utils";
import type { WorkspacePortfolioRow } from "./portfolios-dashboard-client";
import { LucideBriefcaseIcon } from "@/app/ui/lucide-product-icons";

type Props = {
  row: WorkspacePortfolioRow;
  accountSlices: WorkspaceDashboardAccountSlice[];
  opening: boolean;
  onOpen: (portfolioId: string) => void;
};

export function PortfoliosPortfolioCardItem({ row, accountSlices, opening, onOpen }: Props) {
  const { total, barSlices } = buildPortfolioAllocationBarSlices(row.id, accountSlices);
  const cardClass = [
    "portfolios-portfolio-cards__card",
    "flex min-h-[8.75rem] w-full flex-col rounded-3xl border bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)] p-4 text-left transition-[border-color,box-shadow,transform] duration-150",
    "hover:border-[color-mix(in_srgb,var(--xf-gain-green)_30%,transparent)] hover:shadow-md hover:-translate-y-px",
    row.isDefault
      ? "portfolios-portfolio-cards__card--default border-[color-mix(in_srgb,var(--xf-gain-green)_10%,transparent)]"
      : "border-[color-mix(in_srgb,var(--xf-gain-green)_10%,transparent)]",
    "disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
  ].join(" ");
  return (
    <button
      className={cardClass}
      disabled={opening}
      type="button"
      onClick={() => onOpen(row.id)}
    >
      <div className="mb-2 flex flex-1 flex-col gap-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="m-0 flex items-center gap-2 truncate text-xl font-semibold text-[var(--xf-text-100)]" title={row.name}>
              <LucideBriefcaseIcon className="h-5 w-5 text-[var(--xf-text-300)]" aria-hidden />
              <span className="truncate">{row.name}</span>
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
          <span className="shrink-0 font-mono text-base tabular-nums text-[var(--xf-text-100)]">
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
        <p className="mt-2 text-xs font-medium text-[color:var(--xf-tenant-accent,var(--xf-xoptions-accent))]">
          {opening ? "Opening…" : "Open book →"}
        </p>
      </div>
    </button>
  );
}
