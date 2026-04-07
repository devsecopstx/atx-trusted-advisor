"use client";

import type { ReactNode } from "react";

import { ActivityPulseIcon, FolderPortfolioIcon, ListRowsIcon } from "@/app/admin/ui/crud-icons";

export type PortfolioWorkspaceTabId = "portfolios" | "holdings" | "activities" | "watchlist";

function WatchlistTabIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} fill="none" height="14" viewBox="0 0 24 24" width="14">
      <path
        d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function PortfolioManageTabs({
  activeTab,
  onTabChange,
  portfoliosPanel,
  holdingsPanel,
  activitiesPanel,
  watchlistPanel
}: {
  activeTab: PortfolioWorkspaceTabId;
  onTabChange: (tab: PortfolioWorkspaceTabId) => void;
  portfoliosPanel: ReactNode;
  holdingsPanel: ReactNode;
  activitiesPanel: ReactNode;
  watchlistPanel: ReactNode;
}) {
  return (
    <>
      <nav className="portfolio-manage-tabs" aria-label="Portfolio sections">
        <button
          type="button"
          className={`portfolio-manage-tabs__btn${
            activeTab === "portfolios" ? " portfolio-manage-tabs__btn--active" : ""
          }`}
          onClick={() => onTabChange("portfolios")}
        >
          <FolderPortfolioIcon className="crud-icon" />
          Overview
        </button>
        <button
          type="button"
          className={`portfolio-manage-tabs__btn${
            activeTab === "holdings" ? " portfolio-manage-tabs__btn--active" : ""
          }`}
          onClick={() => onTabChange("holdings")}
        >
          <ListRowsIcon className="crud-icon" />
          Holdings
        </button>
        <button
          type="button"
          className={`portfolio-manage-tabs__btn${
            activeTab === "watchlist" ? " portfolio-manage-tabs__btn--active" : ""
          }`}
          onClick={() => onTabChange("watchlist")}
        >
          <WatchlistTabIcon className="crud-icon" />
          Watchlist
        </button>
        <button
          type="button"
          className={`portfolio-manage-tabs__btn${
            activeTab === "activities" ? " portfolio-manage-tabs__btn--active" : ""
          }`}
          onClick={() => onTabChange("activities")}
        >
          <ActivityPulseIcon className="crud-icon" />
          Activities
        </button>
      </nav>
      {activeTab === "portfolios" ? <div className="portfolio-manage-tabs__panel">{portfoliosPanel}</div> : null}
      {activeTab === "holdings" ? <div className="portfolio-manage-tabs__panel">{holdingsPanel}</div> : null}
      {activeTab === "watchlist" ? <div className="portfolio-manage-tabs__panel">{watchlistPanel}</div> : null}
      {activeTab === "activities" ? <div className="portfolio-manage-tabs__panel">{activitiesPanel}</div> : null}
    </>
  );
}
