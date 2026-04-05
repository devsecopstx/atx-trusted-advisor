"use client";

import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import type { AppUserRailAccountPanelDetails } from "@/app/ui/app-user-rail-account-panel";
import type { AppUserDefaultBook } from "@/lib/app-user-default-book";
import type { WorkspaceDashboardAccountSlice } from "@/lib/workspace-dashboard-metrics";

import { PortfoliosAccountsFooter } from "./portfolios-accounts-footer";
import { PortfoliosDashboardClient, type WorkspacePortfolioRow } from "./portfolios-dashboard-client";
import type { PortfoliosHeroTopHolding } from "./portfolios-hero-left-column";
import { PortfoliosMarketsNewsCard } from "./portfolios-markets-news-card";
import { PortfoliosMiniHoldingsGlance } from "./portfolios-mini-holdings-glance";
import { PortfoliosPortfolioCards } from "./portfolios-portfolio-cards";
import { PortfoliosWatchlistCompact } from "./portfolios-watchlist-compact";
import { PortfoliosWorkspaceHeader } from "./portfolios-workspace-header";
import { PortfoliosWorkspaceSidebar } from "./portfolios-workspace-sidebar";

type Props = {
  focusPortfolioId: string | null;
  initialRows: WorkspacePortfolioRow[];
  accountSlices: WorkspaceDashboardAccountSlice[];
  topHoldings: PortfoliosHeroTopHolding[];
  defaultPortfolioId: string | null;
  workspaceBook: AppUserDefaultBook | null;
  totalBookUsd: number;
  isGlobalAdmin: boolean;
  accountDetails: AppUserRailAccountPanelDetails | null;
  accountFeedbackPageLabel?: string;
};

export function PortfoliosWorkspaceClient({
  focusPortfolioId,
  initialRows,
  accountSlices,
  topHoldings,
  defaultPortfolioId,
  workspaceBook,
  totalBookUsd,
  isGlobalAdmin,
  accountDetails,
  accountFeedbackPageLabel
}: Props) {
  const holdingsKey = topHoldings
    .slice(0, 2)
    .map((h) => h.symbol)
    .join(",");

  return (
    <>
      <PortfoliosWorkspaceHeader topHoldingsKey={holdingsKey} totalBookUsd={totalBookUsd} />

      <div className="xchat-body portfolio-page-body">
        <AppUserCollapsibleRailLayout
          mainClassName="app-user-shell-with-rail--padded"
          rail={
            <PortfoliosWorkspaceSidebar
              accountDetails={accountDetails}
              accountFeedbackPageLabel={accountFeedbackPageLabel}
              defaultPortfolioId={defaultPortfolioId}
              isGlobalAdmin={isGlobalAdmin}
              workspaceBook={workspaceBook}
            />
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

              <section className="portfolios-workspace-col portfolios-workspace-col--c min-w-0">
                <PortfoliosWatchlistCompact portfolioId={defaultPortfolioId} />
                <PortfoliosMiniHoldingsGlance topHoldings={topHoldings} />
                <PortfoliosMarketsNewsCard />
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
