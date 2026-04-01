"use client";

import { useMemo } from "react";

import { formatUsd2, formatUsdWhole } from "@/lib/portfolio-overview-metrics";
import type { WorkspaceDashboardAccountSlice } from "@/lib/workspace-dashboard-metrics";

import type { WorkspacePortfolioRow } from "./portfolios-dashboard-client";

type Props = {
  initialRows: WorkspacePortfolioRow[];
  initialAccountSlices: WorkspaceDashboardAccountSlice[];
};

function accountSlicesForPortfolio(
  portfolioId: string,
  slices: WorkspaceDashboardAccountSlice[]
): WorkspaceDashboardAccountSlice[] {
  return slices.filter((s) => s.portfolioId === portfolioId);
}

function WorkspaceAccountsByPortfolioChart({
  rows,
  accountSlices
}: {
  rows: WorkspacePortfolioRow[];
  accountSlices: WorkspaceDashboardAccountSlice[];
}) {
  const groups = useMemo(() => {
    return rows.map((r) => {
      const slices = accountSlicesForPortfolio(r.id, accountSlices);
      const total = slices.reduce((s, x) => s + Math.max(0, x.valueUsd), 0);
      const safe = total > 0 ? total : 1;
      const barSlices = slices.map((x) => ({
        key: `${r.id}-${x.accountId}`,
        label: x.accountName,
        percent: (Math.max(0, x.valueUsd) / safe) * 100,
        valueUsd: x.valueUsd
      }));
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
  const { totalUsd, barSlices } = useMemo(() => {
    const totalUsd = accountSlices.reduce((s, x) => s + Math.max(0, x.valueUsd), 0);
    const safe = totalUsd > 0 ? totalUsd : 1;
    const sorted = [...accountSlices].sort((a, b) => b.valueUsd - a.valueUsd);
    const barSlices = sorted.map((x) => {
      const label = `${x.accountName} · ${x.portfolioName}`;
      const pct = (Math.max(0, x.valueUsd) / safe) * 100;
      return {
        key: `${x.portfolioId}-${x.accountId}`,
        label,
        percent: pct,
        valueUsd: x.valueUsd
      };
    });
    return { totalUsd, barSlices };
  }, [accountSlices]);

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
