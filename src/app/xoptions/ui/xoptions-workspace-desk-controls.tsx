"use client";

import Link from "next/link";

import { AppUserWorkspaceAccountPicker } from "@/app/ui/app-user-workspace-account-picker";
import { AppUserWorkspacePortfolioPicker } from "@/app/ui/app-user-workspace-portfolio-picker";
import { useTenantUxNavVisibility } from "@/app/ui/use-tenant-ux-nav-visibility";
import type { AppUserDefaultBook, AppUserWorkspaceAccountRef } from "@/lib/app-user-default-book";

type XoptionsWorkspaceDeskControlsProps = {
  workspaceBook: AppUserDefaultBook | null;
  portfolioId: string | null;
  portfolioName: string | null;
  accounts: AppUserWorkspaceAccountRef[];
  serverDefaultAccountId: string | null;
  holdingsCount: number;
  hotCount: number;
  cashBalance: number | null;
};

export function XoptionsWorkspaceDeskControls({
  workspaceBook,
  portfolioId,
  portfolioName,
  accounts,
  serverDefaultAccountId,
  holdingsCount,
  hotCount,
  cashBalance
}: XoptionsWorkspaceDeskControlsProps) {
  const { isPathVisible, resolvePreferredHomeHref } = useTenantUxNavVisibility();
  const homeHref = resolvePreferredHomeHref();
  const showPortfoliosLink = isPathVisible("/portfolios");

  return (
    <section className="xoptions-workspace-topbar" aria-label="Workspace desk">
      <div className="xoptions-workspace-topbar__desk">
        {workspaceBook && portfolioId ? (
          <div className="xoptions-workspace-topbar__pickers app-user-rail-workspace-card">
            <AppUserWorkspacePortfolioPicker
              portfolios={workspaceBook.workspacePortfolios}
              selectedPortfolioId={portfolioId}
            />
            <AppUserWorkspaceAccountPicker
              accounts={accounts}
              portfolioId={portfolioId}
              serverDefaultAccountId={serverDefaultAccountId}
            />
          </div>
        ) : (
          <p className="xoptions-workspace-topbar__line text-sm">
            <span className="text-[var(--xf-text-400)]">Portfolio</span>{" "}
            <span className="font-semibold text-[var(--xf-text-200)]">{portfolioName ?? "—"}</span>
          </p>
        )}
        <p className="xoptions-workspace-topbar__glance text-xs text-[var(--xf-text-400)]">
          At a glance: {holdingsCount} holdings
          {typeof cashBalance === "number" && Number.isFinite(cashBalance) ? (
            <>
              {" "}
              · Cash $
              {cashBalance.toLocaleString("en-US", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              })}
            </>
          ) : null}
          {" "}
          · {hotCount} hot symbols
        </p>
      </div>
      <nav className="xoptions-workspace-topbar__nav" aria-label="Workspace navigation">
        <Link className="xoptions-workspace-topbar__nav-link" href={homeHref}>
          Home
        </Link>
        {showPortfoliosLink ? (
          <Link className="xoptions-workspace-topbar__nav-link" href="/portfolios">
            Portfolios
          </Link>
        ) : null}
      </nav>
    </section>
  );
}
