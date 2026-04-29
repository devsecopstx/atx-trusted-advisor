"use client";

import type { ReactNode } from "react";

import { ActivityPulseIcon, FolderPortfolioIcon, ListRowsIcon } from "@/app/admin/ui/crud-icons";

export type PortfolioWorkspaceTabId = "portfolios" | "holdings" | "activities";

export function PortfolioManageTabs({
  activeTab,
  onTabChange,
  portfoliosPanel,
  holdingsPanel,
  activitiesPanel
}: {
  activeTab: PortfolioWorkspaceTabId;
  onTabChange: (tab: PortfolioWorkspaceTabId) => void;
  portfoliosPanel: ReactNode;
  holdingsPanel: ReactNode;
  activitiesPanel: ReactNode;
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
      {activeTab === "activities" ? <div className="portfolio-manage-tabs__panel">{activitiesPanel}</div> : null}
    </>
  );
}
