"use client";

import type { AppUserRailAccountPanelDetails } from "@/app/ui/app-user-rail-account-panel";
import { WorkspaceProductSidebar } from "@/app/ui/workspace-product-sidebar";
import type { AppUserDefaultBook } from "@/lib/app-user-default-book";

export type PortfoliosWorkspaceSidebarProps = {
  defaultPortfolioId: string | null;
  workspaceBook: AppUserDefaultBook | null;
  isGlobalAdmin: boolean;
  accountDetails: AppUserRailAccountPanelDetails | null;
  accountFeedbackPageLabel?: string;
};

/** Same workspace nav as xChat; uses `portfolios-workspace-sidebar` styling. */
export function PortfoliosWorkspaceSidebar({
  defaultPortfolioId,
  workspaceBook,
  isGlobalAdmin,
  accountDetails,
  accountFeedbackPageLabel
}: PortfoliosWorkspaceSidebarProps) {
  return (
    <WorkspaceProductSidebar
      accountDetails={accountDetails}
      accountFeedbackPageLabel={accountFeedbackPageLabel}
      defaultPortfolioId={defaultPortfolioId}
      isGlobalAdmin={isGlobalAdmin}
      showReferenceDocs
      workspaceBook={workspaceBook}
    />
  );
}
