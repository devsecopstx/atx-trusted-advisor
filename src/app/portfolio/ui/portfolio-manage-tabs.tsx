"use client";

import type { ReactNode } from "react";
import { useState } from "react";

type TabId = "portfolios" | "holdings" | "activity";

export function PortfolioManageTabs({
  portfoliosPanel,
  holdingsPanel,
  activityPanel
}: {
  portfoliosPanel: ReactNode;
  holdingsPanel: ReactNode;
  activityPanel: ReactNode;
}) {
  const [tab, setTab] = useState<TabId>("portfolios");

  return (
    <>
      <nav className="portfolio-manage-tabs" aria-label="Portfolio views">
        <button
          type="button"
          className={`portfolio-manage-tabs__btn${tab === "portfolios" ? " portfolio-manage-tabs__btn--active" : ""}`}
          onClick={() => setTab("portfolios")}
        >
          My portfolios
        </button>
        <button
          type="button"
          className={`portfolio-manage-tabs__btn${tab === "holdings" ? " portfolio-manage-tabs__btn--active" : ""}`}
          onClick={() => setTab("holdings")}
        >
          My holdings
        </button>
        <button
          type="button"
          className={`portfolio-manage-tabs__btn${tab === "activity" ? " portfolio-manage-tabs__btn--active" : ""}`}
          onClick={() => setTab("activity")}
        >
          My activity
        </button>
      </nav>
      {tab === "portfolios" ? <div className="portfolio-manage-tabs__panel">{portfoliosPanel}</div> : null}
      {tab === "holdings" ? <div className="portfolio-manage-tabs__panel">{holdingsPanel}</div> : null}
      {tab === "activity" ? <div className="portfolio-manage-tabs__panel">{activityPanel}</div> : null}
    </>
  );
}
