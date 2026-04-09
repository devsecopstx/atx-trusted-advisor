"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatUsd2, formatUsdWhole } from "@/lib/portfolio-overview-metrics";
import type { WorkspaceDashboardAccountSlice } from "@/lib/workspace-dashboard-metrics";

import { buildAllAccountsBarSlices } from "./portfolios-allocation-utils";

type Props = {
  accountSlices: WorkspaceDashboardAccountSlice[];
};

export function PortfoliosAccountsFooter({ accountSlices }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { totalUsd, barSlices } = useMemo(() => buildAllAccountsBarSlices(accountSlices), [accountSlices]);

  if (accountSlices.length === 0) {
    return null;
  }

  return (
    <footer className="portfolios-accounts-footer mt-6 rounded-lg border border-white/10 bg-[color-mix(in_srgb,var(--xf-text-100)_4%,transparent)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--xf-text-300)]">
            All accounts
          </p>
          <p className="m-0 font-mono text-sm tabular-nums text-[var(--xf-text-100)]">
            Total book{" "}
            <span className="text-[color:var(--xf-tenant-accent,var(--xf-xoptions-accent))]">
              {formatUsdWhole(totalUsd)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-md border border-white/15 bg-[var(--xf-bg-800)] px-3 py-1 text-xs text-[var(--xf-text-100)] hover:bg-[var(--xf-bg-700)]"
            type="button"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? "Hide detail" : "Expand"}
          </button>
          <Link
            className="rounded-md bg-[var(--xf-tenant-accent,var(--xf-xoptions-accent))] px-3 py-1 text-xs font-medium text-white hover:opacity-90"
            href="/portfolio"
          >
            View all accounts
          </Link>
        </div>
      </div>

      <div className="portfolio-allocation portfolio-allocation--compact mt-2" role="presentation">
        <div
          className="portfolio-allocation__bar portfolio-allocation__bar--accounts portfolios-accounts-footer__bar"
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

      <div className="portfolios-accounts-footer__scroll mt-3 flex gap-2 overflow-x-auto pb-1">
        {barSlices.map((s) => (
          <div
            key={s.key}
            className="min-w-[140px] shrink-0 rounded-md border border-white/10 bg-[var(--xf-bg-800)] px-2 py-1.5"
          >
            <p className="m-0 truncate text-[0.65rem] text-[var(--xf-text-100)]" title={s.label}>
              {s.label}
            </p>
            <p className="m-0 font-mono text-xs tabular-nums text-[var(--xf-text-200)]">{formatUsd2(s.valueUsd)}</p>
            <p className="m-0 text-[0.65rem] text-[var(--xf-text-300)]">{s.percent.toFixed(0)}%</p>
          </div>
        ))}
      </div>

      {expanded ? (
        <ul className="mt-3 max-h-40 list-none space-y-1 overflow-y-auto p-0 m-0 text-xs text-[var(--xf-text-200)]">
          {barSlices.map((s) => (
            <li key={`${s.key}-detail`} className="flex justify-between gap-2 font-mono tabular-nums">
              <span className="min-w-0 truncate" title={s.label}>
                {s.label}
              </span>
              <span>{formatUsd2(s.valueUsd)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </footer>
  );
}
