"use client";

import Link from "next/link";

import { PortfoliosHotPicksView } from "@/app/portfolios/portfolios-hot-picks-view";

type Props = {
  portfolioId: string | null;
  defaultPortfolioId: string | null;
  portfolioName: string | null;
  accountName: string | null;
};

export function XoptionsWeeklyReviewWorkspace({
  portfolioId,
  defaultPortfolioId,
  portfolioName,
  accountName
}: Props) {
  const bookLabel =
    portfolioName && accountName
      ? `${portfolioName} · ${accountName}`
      : portfolioName ?? accountName ?? "No workspace book selected";

  const todayLabel = new Date().toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  return (
    <div className="xoptions-weekly-review-page mx-auto max-w-5xl px-3 py-4 sm:px-4">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--xf-green-500)]">
            aTx⚡Finance · xOptions
          </p>
          <h1 className="m-0 mt-0.5 text-lg font-bold tracking-tight text-[var(--xf-text-100)]">
            Weekly desk review
          </h1>
          <p className="xoptions-hint mt-1 text-sm text-[var(--xf-text-400)]">
            Live Hot Picks for the next 7–21 DTE on your active book — build in xOptions when a structure
            fits.
          </p>
        </div>
        <span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[0.65rem] text-[var(--xf-text-300)]">
          {todayLabel}
        </span>
      </header>

      <section className="mb-4 rounded-[var(--xf-radius-md)] border border-white/10 bg-[var(--xf-surface-700)]/80 p-3">
        <p className="m-0 text-[0.62rem] font-semibold uppercase tracking-wider text-[var(--xf-text-400)]">
          Portfolio context
        </p>
        <p className="m-0 mt-1 text-sm font-semibold text-[var(--xf-text-100)]">{bookLabel}</p>
        <p className="m-0 mt-2 text-xs text-[var(--xf-text-400)]">
          Scanner defaults: balanced bias · edge score ≥ 60 · IV-aware income structures.{" "}
          <Link className="text-[var(--xf-green-500)] underline-offset-2 hover:underline" href="/portfolios/hot-picks">
            Open full Hot Picks
          </Link>
        </p>
      </section>

      <PortfoliosHotPicksView defaultPortfolioId={defaultPortfolioId} portfolioId={portfolioId} />

      <footer className="mt-6 border-t border-white/10 px-1 py-3 text-center">
        <p className="m-0 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--xf-warning-400)]">
          Educational use only — not financial advice
        </p>
      </footer>
    </div>
  );
}
