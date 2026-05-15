"use client";

import { formatUsd2 } from "@/lib/portfolio-overview-metrics";
import type { WorkspaceBooksDayMarkSummary } from "@/lib/workspace-dashboard-metrics";

function signedUsd(amount: number): string {
  const core = formatUsd2(Math.abs(amount));
  if (amount > 0) {
    return `+${core}`;
  }
  if (amount < 0) {
    return `-${core}`;
  }
  return formatUsd2(0);
}

function signedPct(pct: number): string {
  const sign = pct > 0 ? "+" : pct < 0 ? "" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function dayToneClass(dayChangeUsd: number): string {
  if (dayChangeUsd > 0) {
    return "text-[var(--xf-gain-green)]";
  }
  if (dayChangeUsd < 0) {
    return "text-red-300";
  }
  return "text-[var(--xf-text-200)]";
}

function shouldShowBooksDayMark(summary: WorkspaceBooksDayMarkSummary): boolean {
  return (
    summary.hasQuoteCoverage || (Number.isFinite(summary.dayChangeUsd) && summary.dayChangeUsd !== 0)
  );
}

type Props = {
  summary: WorkspaceBooksDayMarkSummary;
  variant: "header" | "section";
};

export function PortfoliosBooksDayMarkUI({ summary, variant }: Props) {
  const show = shouldShowBooksDayMark(summary);
  const tone = dayToneClass(summary.dayChangeUsd);

  if (variant === "header") {
    return (
      <>
        <span className="text-[var(--xf-text-300)]">Portfolio day Δ </span>
        {show ? (
          <span className={`font-mono tabular-nums ${tone}`}>
            {signedUsd(summary.dayChangeUsd)}
            {summary.dayChangePercent !== null ? (
              <span>{` (${signedPct(summary.dayChangePercent)})`}</span>
            ) : null}
          </span>
        ) : (
          <span className="text-[var(--xf-text-300)]">—</span>
        )}
      </>
    );
  }

  if (!show) {
    return (
      <p className="mb-2 text-xs leading-relaxed text-[var(--xf-text-300)]">
        <span className="font-medium text-[var(--xf-text-200)]">Today&apos;s gain/loss</span>
        <span className="mx-1.5 font-mono tabular-nums">—</span>
        <span className="text-[var(--xf-text-400)]">
          Stock day mark (Yahoo); options and cash excluded; largest symbols quoted first (capped).
        </span>
      </p>
    );
  }

  return (
    <p className="mb-3 text-sm leading-snug">
      <span className={`font-mono font-semibold tabular-nums ${tone}`}>
        {signedUsd(summary.dayChangeUsd)}
        {summary.dayChangePercent !== null ? (
          <span className="font-normal">{` (${signedPct(summary.dayChangePercent)})`}</span>
        ) : null}
      </span>
      <span className="ml-2 text-xs font-normal text-[var(--xf-text-300)]">Today&apos;s gain/loss</span>
    </p>
  );
}
