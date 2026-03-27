"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type PortfolioManageSection =
  | "accounts"
  | "watchlist"
  | "scoring"
  | "tasks"
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
  { key: "accounts", label: "Accounts", path: "accounts" },
  { key: "watchlist", label: "Watchlist", path: "watchlist" },
  { key: "scoring", label: "Scoring", path: "scoring" },
  { key: "tasks", label: "Tasks", path: "tasks" },
  { key: "alerts", label: "Alerts", path: "alerts" },
  { key: "recommendations", label: "Recommendations", path: "recommendations" },
  { key: "delivery_channels", label: "Delivery channels", path: "delivery-channels" }
];

export function PortfolioManageNav({ portfolioId, active, children }: NavProps) {
  const pid = encodeURIComponent(portfolioId);
  return (
    <div className="tool-row" style={{ flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
      <Link className="cta cta-secondary" href="/admin/portfolios">
        ← Portfolios
      </Link>
      {SECTIONS.map(({ key, label, path }) => (
        <Link
          key={key}
          className={key === active ? "cta cta-primary" : "cta cta-secondary"}
          href={`/admin/portfolios/${pid}/${path}`}
        >
          {label}
        </Link>
      ))}
      {children}
    </div>
  );
}
