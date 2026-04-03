"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { ActivityPulseIcon, FolderPortfolioIcon, ListRowsIcon } from "@/app/admin/ui/crud-icons";

type TabId = "portfolios" | "holdings" | "activities";

export function PortfolioManageTabs({
  portfoliosPanel,
  holdingsPanel,
  activitiesPanel
}: {
  portfoliosPanel: ReactNode;
  holdingsPanel: ReactNode;
  activitiesPanel: ReactNode;
}) {
  const [tab, setTab] = useState<TabId>("portfolios");

  return (
    <>
      <nav className="portfolio-manage-tabs" aria-label="Portfolio sections">
        <button
          type="button"
          className={`portfolio-manage-tabs__btn${tab === "portfolios" ? " portfolio-manage-tabs__btn--active" : ""}`}
          onClick={() => setTab("portfolios")}
        >
          <FolderPortfolioIcon className="crud-icon" />
          Overview
        </button>
        <button
          type="button"
          className={`portfolio-manage-tabs__btn${tab === "holdings" ? " portfolio-manage-tabs__btn--active" : ""}`}
          onClick={() => setTab("holdings")}
        >
          <ListRowsIcon className="crud-icon" />
          Holdings
        </button>
        <button
          type="button"
          className={`portfolio-manage-tabs__btn${tab === "activities" ? " portfolio-manage-tabs__btn--active" : ""}`}
          onClick={() => setTab("activities")}
        >
          <ActivityPulseIcon className="crud-icon" />
          Activities
        </button>
      </nav>
      {tab === "portfolios" ? <div className="portfolio-manage-tabs__panel">{portfoliosPanel}</div> : null}
      {tab === "holdings" ? <div className="portfolio-manage-tabs__panel">{holdingsPanel}</div> : null}
      {tab === "activities" ? <div className="portfolio-manage-tabs__panel">{activitiesPanel}</div> : null}
    </>
  );
}
