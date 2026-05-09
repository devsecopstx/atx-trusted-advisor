"use client";

import type { ReactNode } from "react";

import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import type { AppUserRailAccountPanelDetails } from "@/app/ui/app-user-rail-account-panel";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import type { AppUserDefaultBook } from "@/lib/app-user-default-book";
import type { SessionUser } from "@/lib/auth";
import type { WorkspaceDashboardAccountSlice } from "@/lib/workspace-dashboard-metrics";
import type { WorkspaceTenantHeaderContext } from "@/lib/workspace-tenant-header";

import { PortfoliosAccountsFooter } from "./portfolios-accounts-footer";
import { PortfoliosDashboardClient, type WorkspacePortfolioRow } from "./portfolios-dashboard-client";
import type { PortfoliosHeroTopHolding } from "./portfolios-hero-left-column";
import { PortfoliosMarketsNewsCard } from "./portfolios-markets-news-card";
import { PortfoliosMiniHoldingsGlance } from "./portfolios-mini-holdings-glance";
import { PortfoliosPortfolioCards } from "./portfolios-portfolio-cards";
import { PortfoliosWatchlistCompact } from "./portfolios-watchlist-compact";
import { PortfoliosWorkspaceHeader } from "./portfolios-workspace-header";
import { PortfoliosWorkspaceSidebar } from "./portfolios-workspace-sidebar";

export type PortfoliosWorkspaceDeskHints = {
  watchlistSymbolCount: number;
  /** Server-resolved symbols for visibility when hot IV/OI scan is empty or still loading. */
  watchlistPreviewSymbols?: string[];
  activeAlertsCount: number;
  ibkrLinkedAccountCount: number | null;
};

type Props = {
  session: SessionUser;
  workspaceTenant: WorkspaceTenantHeaderContext | null;
  focusPortfolioId: string | null;
  initialRows: WorkspacePortfolioRow[];
  accountSlices: WorkspaceDashboardAccountSlice[];
  topHoldings: PortfoliosHeroTopHolding[];
  /** Cookie / workspace active book — same scope as full watchlist when using `?portfolioId=`. */
  chosenPortfolioId: string | null;
  /** Fallback book id for watchlist hot API when cookie book is unset (symbols are still tenant.user-global). */
  deskWatchlistPortfolioId?: string | null;
  defaultPortfolioId: string | null;
  workspaceBook: AppUserDefaultBook | null;
  totalBookUsd: number;
  isGlobalAdmin: boolean;
  accountDetails: AppUserRailAccountPanelDetails | null;
  accountFeedbackPageLabel?: string;
  workspaceDeskHints?: PortfoliosWorkspaceDeskHints | null;
  visiblePathPrefixes?: string[];
  /** Legal footer rendered only under main column so the workspace rail spans full viewport height. */
  workspaceFooter?: ReactNode;
};

export function PortfoliosWorkspaceClient({
  session,
  workspaceTenant,
  focusPortfolioId,
  initialRows,
  accountSlices,
  topHoldings,
  chosenPortfolioId,
  deskWatchlistPortfolioId = null,
  defaultPortfolioId,
  workspaceBook,
  totalBookUsd,
  isGlobalAdmin,
  accountDetails,
  accountFeedbackPageLabel,
  workspaceDeskHints = null,
  visiblePathPrefixes,
  workspaceFooter
}: Props) {
  const holdingsKey = topHoldings
    .slice(0, 2)
    .map((h) => h.symbol)
    .join(",");

  return (
    <>
      <div className="workspace-product-sticky-top sticky top-0 z-50 flex shrink-0 flex-col bg-[var(--xf-bg-800)]">
        <div className="workspace-product-approved-header-slot">
          <AppUserApprovedHeader
            current="portfolio"
            feedbackPageLabel={accountFeedbackPageLabel}
            session={session}
            workspaceTenant={workspaceTenant}
          />
        </div>
        <PortfoliosWorkspaceHeader
          deskPortfolioId={deskWatchlistPortfolioId ?? chosenPortfolioId}
          topHoldingsKey={holdingsKey}
          totalBookUsd={totalBookUsd}
          visiblePathPrefixes={visiblePathPrefixes}
        />
      </div>

      <div className="portfolio-page-body xchat-body flex min-h-0 flex-1 flex-col overflow-hidden">
        <AppUserCollapsibleRailLayout
          mainClassName="app-user-shell-with-rail--padded min-h-0 flex-1 overflow-y-auto overscroll-contain"
          mainFooter={workspaceFooter}
          rail={
            <PortfoliosWorkspaceSidebar
              accountDetails={accountDetails}
              accountFeedbackPageLabel={accountFeedbackPageLabel}
              defaultPortfolioId={defaultPortfolioId}
              isGlobalAdmin={isGlobalAdmin}
              visiblePathPrefixes={visiblePathPrefixes}
              workspaceBook={workspaceBook}
            />
          }
          railChrome="workspace-product"
          workspaceProductShellClassName="min-h-0 flex-1 overflow-hidden"
        >
          {/*
           * Branding from Tenant Settings → Branding (tenantPreferences). Updates apply immediately via --xf-tenant-accent + TenantBrandingProvider.
           */}
          <div className="portfolios-workspace-main portfolios-workspace-tenant-chrome billing-page min-w-0">
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
                <PortfoliosWatchlistCompact
                  deskHints={workspaceDeskHints}
                  portfolioId={deskWatchlistPortfolioId ?? chosenPortfolioId}
                />
                <PortfoliosMiniHoldingsGlance
                  deskPortfolioId={deskWatchlistPortfolioId ?? chosenPortfolioId}
                  topHoldings={topHoldings}
                />
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
