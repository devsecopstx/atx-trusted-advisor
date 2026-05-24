"use client";

import type { ReactNode } from "react";

import { PortfoliosHotPicksView } from "@/app/portfolios/portfolios-hot-picks-view";
import { PortfoliosWorkspaceHeader } from "@/app/portfolios/portfolios-workspace-header";
import { PortfoliosWorkspaceSidebar } from "@/app/portfolios/portfolios-workspace-sidebar";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import type { AppUserRailAccountPanelDetails } from "@/app/ui/app-user-rail-account-panel";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import type { AppUserDefaultBook } from "@/lib/app-user-default-book";
import type { SessionUser } from "@/lib/auth";
import type {
    WorkspaceBooksDayMarkSummary,
    WorkspaceTopBookMoverRow
} from "@/lib/workspace-dashboard-metrics";
import type { WorkspaceTenantHeaderContext } from "@/lib/workspace-tenant-header";

type Props = {
  session: SessionUser;
  workspaceTenant: WorkspaceTenantHeaderContext | null;
  chosenPortfolioId: string | null;
  defaultPortfolioId: string | null;
  workspaceBook: AppUserDefaultBook | null;
  totalMarketValueUsd: number;
  booksDayMark: WorkspaceBooksDayMarkSummary;
  topBookMovers: WorkspaceTopBookMoverRow[];
  isGlobalAdmin: boolean;
  accountDetails: AppUserRailAccountPanelDetails | null;
  visiblePathPrefixes?: string[];
  workspaceFooter?: ReactNode;
};

export function PortfoliosHotPicksWorkspaceClient({
  session,
  workspaceTenant,
  chosenPortfolioId,
  defaultPortfolioId,
  workspaceBook,
  totalMarketValueUsd,
  booksDayMark,
  topBookMovers,
  isGlobalAdmin,
  accountDetails,
  visiblePathPrefixes,
  workspaceFooter
}: Props) {
  const holdingsKey = topBookMovers
    .slice(0, 4)
    .map((m) => m.symbol)
    .join(",");

  return (
    <>
      <div className="workspace-product-sticky-top sticky top-0 z-50 flex shrink-0 flex-col bg-[var(--xf-bg-800)]">
        <div className="workspace-product-approved-header-slot">
          <AppUserApprovedHeader
            current="portfolio"
            session={session}
            workspaceTenant={workspaceTenant}
          />
        </div>
        <PortfoliosWorkspaceHeader
          booksDayMark={booksDayMark}
          deskPortfolioId={chosenPortfolioId}
          topHoldingsKey={holdingsKey}
          totalMarketValueUsd={totalMarketValueUsd}
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
              defaultPortfolioId={defaultPortfolioId}
              isGlobalAdmin={isGlobalAdmin}
              visiblePathPrefixes={visiblePathPrefixes}
              workspaceBook={workspaceBook}
            />
          }
          railChrome="workspace-product"
          workspaceProductShellClassName="min-h-0 flex-1 overflow-hidden"
        >
          <div className="portfolios-workspace-main portfolios-workspace-tenant-chrome billing-page min-w-0">
            <PortfoliosHotPicksView
              defaultPortfolioId={defaultPortfolioId}
              portfolioId={chosenPortfolioId}
            />
            <p className="mt-6 text-xs text-[var(--xf-text-300)]">
              <span className="xf-disclaimer-emphasis">Not financial advice.</span> Hot Picks uses rule-based engine
              scoring and Yahoo option chains; verify strikes and liquidity before trading.
            </p>
          </div>
        </AppUserCollapsibleRailLayout>
      </div>
    </>
  );
}
