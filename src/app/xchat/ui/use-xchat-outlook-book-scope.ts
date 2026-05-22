"use client";

import { useMemo, useSyncExternalStore } from "react";

import { useWorkspaceAccountSelection } from "@/app/ui/use-workspace-account-selection";
import type { AppUserDefaultBook } from "@/lib/app-user-default-book";
import {
    WORKSPACE_PORTFOLIO_CHANGED_EVENT,
    type WorkspacePortfolioChangedDetail
} from "@/lib/workspace-portfolio-selection";
import {
    resolveXchatOutlookBookScope,
    type XchatOutlookBookScope
} from "@/lib/xchat/xchat-outlook-desk";

let clientPortfolioOverrideId: string | null = null;

function subscribeWorkspacePortfolioOverride(onChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<WorkspacePortfolioChangedDetail>).detail;
    const next = detail?.portfolioId?.trim() ?? "";
    if (!next) {
      return;
    }
    clientPortfolioOverrideId = next;
    onChange();
  };
  window.addEventListener(WORKSPACE_PORTFOLIO_CHANGED_EVENT, handler);
  return () => {
    window.removeEventListener(WORKSPACE_PORTFOLIO_CHANGED_EVENT, handler);
    clientPortfolioOverrideId = null;
  };
}

function readEffectiveWorkspacePortfolioId(
  workspacePortfolioId: string | null | undefined,
  workspaceBook: AppUserDefaultBook | null | undefined
): string {
  const override = clientPortfolioOverrideId?.trim() ?? "";
  if (override) {
    return override;
  }
  const fromProp = workspacePortfolioId?.trim() ?? "";
  if (fromProp) {
    return fromProp;
  }
  return workspaceBook?.portfolioId?.trim() ?? "";
}

/** Live portfolio + account labels for the welcome-row outlook badge (rail pickers). */
export function useXchatOutlookBookScope(
  workspaceBook: AppUserDefaultBook | null | undefined,
  workspacePortfolioId: string | null | undefined
): XchatOutlookBookScope | null {
  const effectivePortfolioId = useSyncExternalStore(
    subscribeWorkspacePortfolioOverride,
    () =>
      readEffectiveWorkspacePortfolioId(workspacePortfolioId, workspaceBook),
    () => workspacePortfolioId?.trim() || workspaceBook?.portfolioId?.trim() || ""
  );

  const accountIds = useMemo(() => {
    if (!workspaceBook || workspaceBook.portfolioId !== effectivePortfolioId) {
      return [];
    }
    return workspaceBook.accounts.map((a) => a.id);
  }, [effectivePortfolioId, workspaceBook]);

  const serverDefaultAccountId =
    workspaceBook?.portfolioId === effectivePortfolioId ? workspaceBook.accountId : null;

  const selectedAccountId = useWorkspaceAccountSelection(
    effectivePortfolioId || undefined,
    accountIds,
    serverDefaultAccountId
  );

  return useMemo(
    () => resolveXchatOutlookBookScope(workspaceBook, effectivePortfolioId, selectedAccountId),
    [effectivePortfolioId, selectedAccountId, workspaceBook]
  );
}
