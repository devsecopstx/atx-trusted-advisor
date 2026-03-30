"use client";

import type { ReactNode } from "react";

import { AdminPortfolioListRail } from "./admin-portfolio-list-rail";

type AdminPortfolioChildWorkspaceProps = {
  portfolioId: string;
  children: ReactNode;
};

export function AdminPortfolioChildWorkspace({ portfolioId, children }: AdminPortfolioChildWorkspaceProps) {
  return (
    <div className="admin-portfolio-workspace">
      <AdminPortfolioListRail portfolioId={portfolioId} />
      <div className="admin-portfolio-workspace__main">{children}</div>
    </div>
  );
}
