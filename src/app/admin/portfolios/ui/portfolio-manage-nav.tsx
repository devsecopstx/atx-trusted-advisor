"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type PortfolioManageSection =
  | "tools"
  | "accounts"
  | "watchlist"
  | "scoring"
  | "alerts"
  | "recommendations"
  | "delivery_channels";

type NavProps = {
  portfolioId: string;
  active: PortfolioManageSection;
  /** Extra controls (refresh, save) rendered after nav links */
  children?: ReactNode;
};

const SECTIONS: { key: PortfolioManageSection; label: string; path: string }[] = [
  { key: "tools", label: "Tools", path: "tools" },
  { key: "accounts", label: "Accounts", path: "accounts" },
  { key: "watchlist", label: "Watchlist", path: "watchlist" },
  { key: "scoring", label: "Scoring", path: "scoring" },
  { key: "alerts", label: "Alerts", path: "alerts" },
  { key: "recommendations", label: "Recommendations", path: "recommendations" },
  { key: "delivery_channels", label: "Delivery channels", path: "delivery-channels" }
];

export function PortfolioManageNav({ portfolioId, active, children }: NavProps) {
  const pid = encodeURIComponent(portfolioId);
  return (
    <div className="admin-portfolio-tool-panel">
      <div className="admin-portfolio-tool-panel__tabs-row">
        <Link className="admin-portfolio-tool-back" href="/admin/portfolios">
          ← All portfolios
        </Link>
        <nav className="admin-portfolio-tool-tablist" aria-label="Portfolio tools">
          {SECTIONS.map(({ key, label, path }) => (
            <Link
              key={key}
              className={`admin-portfolio-tool-tab${key === active ? " admin-portfolio-tool-tab--active" : ""}`}
              href={`/admin/portfolios/${pid}/${path}`}
              aria-current={key === active ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      {children ? <div className="admin-portfolio-tool-panel__actions tool-row">{children}</div> : null}
    </div>
  );
}
