"use client";

import { useMemo } from "react";

import { formatUsd2, formatUsdWhole } from "@/lib/portfolio-overview-metrics";
import type { WorkspaceDashboardAccountSlice } from "@/lib/workspace-dashboard-metrics";

import { buildAllAccountsBarSlices, buildPortfolioAllocationBarSlices } from "./portfolios-allocation-utils";
import type { WorkspacePortfolioRow } from "./portfolios-dashboard-client";

type Props = {
  initialRows: WorkspacePortfolioRow[];
  initialAccountSlices: WorkspaceDashboardAccountSlice[];
};

function WorkspaceAccountsByPortfolioChart({
  rows,
  accountSlices
}: {
  rows: WorkspacePortfolioRow[];
  accountSlices: WorkspaceDashboardAccountSlice[];
}) {
  const groups = useMemo(() => {
    return rows.map((r) => {
      const { total, barSlices } = buildPortfolioAllocationBarSlices(r.id, accountSlices);
      return { portfolioId: r.id, portfolioName: r.name, total, barSlices };
    });
  }, [rows, accountSlices]);

  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="portfolio-panel portfolio-panel--tight">
      <h3 className="portfolio-panel__title portfolio-panel__title--sub">Accounts by portfolio</h3>
      <p className="portfolio-metric__label mb-1 text-[var(--xf-text-200)]">
        Book per account (ids are stable; names are display-only).
      </p>
      <div className="portfolios-dashboard-chart-stack flex flex-col">
        {groups.map((g) => (
          <div key={g.portfolioId}>
            <h4 className="portfolios-dashboard-chart-subheading font-medium text-[var(--xf-text-100)]">
              {g.portfolioName}
            </h4>
            {g.barSlices.length === 0 ? (
              <p className="text-xs text-[var(--xf-text-300)]">No accounts yet.</p>
            ) : (
              <div className="portfolio-allocation">
                <div className="portfolio-allocation__bar portfolio-allocation__bar--accounts" role="presentation">
                  {g.barSlices.map((s) => (
                    <div
                      key={s.key}
                      className="portfolio-allocation__segment"
                      style={{ flexGrow: Math.max(s.percent, 0.01) }}
                      title={`${s.label}: ${s.percent.toFixed(1)}% (${formatUsd2(s.valueUsd)})`}
                    />
                  ))}
                </div>
                <ul className="portfolio-allocation__legend portfolio-allocation__legend--plain">
                  {g.barSlices.map((s) => (
                    <li key={s.key}>
                      <span className="min-w-0 truncate" title={s.label}>
                        {s.label}
                      </span>
                      <span>{s.percent.toFixed(0)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function WorkspaceAllAccountsChart({ accountSlices }: { accountSlices: WorkspaceDashboardAccountSlice[] }) {
  const { totalUsd, barSlices } = useMemo(() => buildAllAccountsBarSlices(accountSlices), [accountSlices]);

  if (accountSlices.length === 0) {
    return null;
  }

  return (
    <section className="portfolio-panel portfolio-panel--tight">
      <h3 className="portfolio-panel__title portfolio-panel__title--sub">All accounts</h3>
      <p className="portfolio-metric__label mb-1">
        Total:{" "}
        <span className="font-mono text-[var(--xf-text-100)] tabular-nums">{formatUsdWhole(totalUsd)}</span>
      </p>
      <div className="portfolio-allocation">
        <div className="portfolio-allocation__bar portfolio-allocation__bar--accounts" role="presentation">
          {barSlices.map((s) => (
            <div
              key={s.key}
              className="portfolio-allocation__segment"
              style={{ flexGrow: Math.max(s.percent, 0.01) }}
              title={`${s.label}: ${s.percent.toFixed(1)}% (${formatUsd2(s.valueUsd)})`}
            />
          ))}
        </div>
        <ul className="portfolio-allocation__legend portfolio-allocation__legend--plain">
          {barSlices.map((s) => (
            <li key={s.key}>
              <span className="min-w-0 truncate" title={s.label}>
                {s.label}
              </span>
              <span>{s.percent.toFixed(0)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Hero-band charts: two chart panels in a row, compact tokens — pairs with `portfolios-dashboard.css`. */
export function PortfoliosHeroCharts({ initialRows, initialAccountSlices }: Props) {
  return (
    <aside
      className="portfolio-top-band__charts portfolios-dashboard-charts--compact xf-noise-overlay flex min-h-0 min-w-0 flex-1 flex-col"
      aria-label="Portfolio book charts"
    >
      <div className="portfolio-top-band__charts-inner grid gap-2 md:grid-cols-2 md:gap-3">
        <WorkspaceAccountsByPortfolioChart accountSlices={initialAccountSlices} rows={initialRows} />
        <WorkspaceAllAccountsChart accountSlices={initialAccountSlices} />
      </div>
    </aside>
  );
}
