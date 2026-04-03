"use client";

import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import type { WorkspaceDashboardAccountSlice } from "@/lib/workspace-dashboard-metrics";

import { PortfoliosAccountsFooter } from "./portfolios-accounts-footer";
import { PortfoliosDashboardClient, type WorkspacePortfolioRow } from "./portfolios-dashboard-client";
import { PortfoliosMiniHoldingsGlance } from "./portfolios-mini-holdings-glance";
import type { PortfoliosHeroTopHolding } from "./portfolios-hero-left-column";
import { PortfoliosOptionsHeroCard } from "./portfolios-options-hero-card";
import { PortfoliosPortfolioCards } from "./portfolios-portfolio-cards";
import type { PortfoliosWorkspaceHeaderSession } from "./portfolios-workspace-header";
import { PortfoliosWorkspaceHeader } from "./portfolios-workspace-header";
import { PortfoliosWorkspaceSidebar } from "./portfolios-workspace-sidebar";
import { PortfoliosWatchlistCompact } from "./portfolios-watchlist-compact";

type Props = {
  focusPortfolioId: string | null;
  initialRows: WorkspacePortfolioRow[];
  accountSlices: WorkspaceDashboardAccountSlice[];
  topHoldings: PortfoliosHeroTopHolding[];
  defaultPortfolioId: string | null;
  totalBookUsd: number;
  headerSession: PortfoliosWorkspaceHeaderSession;
};

export function PortfoliosWorkspaceClient({
  focusPortfolioId,
  initialRows,
  accountSlices,
  topHoldings,
  defaultPortfolioId,
  totalBookUsd,
  headerSession
}: Props) {
  const holdingsKey = topHoldings
    .slice(0, 2)
    .map((h) => h.symbol)
    .join(",");
  const topSymbol = topHoldings[0]?.symbol ?? null;

  return (
    <>
      <PortfoliosWorkspaceHeader
        defaultPortfolioId={defaultPortfolioId}
        session={headerSession}
        topHoldingsKey={holdingsKey}
        totalBookUsd={totalBookUsd}
      />

      <div className="xchat-body portfolio-page-body">
        <AppUserCollapsibleRailLayout
          mainClassName="app-user-shell-with-rail--padded"
          rail={
            <PortfoliosWorkspaceSidebar defaultPortfolioId={defaultPortfolioId} topSymbol={topSymbol} />
          }
        >
          <div className="portfolios-workspace-main billing-page min-w-0">
            <div className="portfolios-workspace-grid">
              <section
                className="portfolios-workspace-col portfolios-workspace-col--a min-w-0"
                id="portfolios-workspace-books"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="m-0 text-sm font-semibold text-[var(--xf-text-100)]">Your books</h2>
                </div>
                <PortfoliosPortfolioCards accountSlices={accountSlices} initialRows={initialRows} />
                <details className="portfolios-workspace-advanced mt-4 rounded-lg border border-white/10 bg-[var(--xf-bg-800)]/40 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-[var(--xf-text-200)]">
                    New portfolio · rename · default · delete
                  </summary>
                  <div className="mt-3">
                    <PortfoliosDashboardClient focusPortfolioId={focusPortfolioId} initialRows={initialRows} />
                  </div>
                </details>
              </section>

              <section className="portfolios-workspace-col portfolios-workspace-col--b min-w-0">
                <PortfoliosOptionsHeroCard defaultSymbol={topSymbol} />
              </section>

              <section className="portfolios-workspace-col portfolios-workspace-col--c min-w-0">
                <PortfoliosWatchlistCompact portfolioId={defaultPortfolioId} />
                <PortfoliosMiniHoldingsGlance holdingsKey={holdingsKey} topHoldings={topHoldings} />
              </section>
            </div>

            <PortfoliosAccountsFooter accountSlices={accountSlices} />

            <p className="mt-4 text-xs text-[var(--xf-text-300)]">
              <span className="xf-disclaimer-emphasis">Not financial advice.</span> Values are book-style totals (cash +
              cost basis), not live market marks.
            </p>
          </div>
        </AppUserCollapsibleRailLayout>
      </div>
    </>
  );
}
