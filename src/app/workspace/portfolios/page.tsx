import { redirect } from "next/navigation";

import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { getSessionUser } from "@/lib/auth";
import {
  listWorkspaceDashboardAccountSlices,
  type WorkspaceDashboardAccountSlice
} from "@/lib/workspace-dashboard-metrics";
import { getPortfolioTotalBookUsdForSessionUser } from "@/lib/portfolio-total-book-usd";
import { listPortfoliosForSessionUser } from "@/modules/core-admin/repository";
import type { Portfolio } from "@/modules/core-admin/types";
import { portfolioKindChoiceLabel } from "@/modules/core-admin/types";
import { canUserLogin } from "@/modules/identity/authorization";

import { WorkspacePortfoliosClient, type WorkspacePortfolioRow } from "./workspace-portfolios-client";

import "@/app/account/billing/billing-plans.css";
import "@/app/portfolio/portfolio.css";

export const dynamic = "force-dynamic";

export default async function WorkspacePortfoliosPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/xchat?next=/workspace/portfolios");
  }
  if (!canUserLogin(session.roles)) {
    redirect("/xchat");
  }

  const portfolios = await listPortfoliosForSessionUser({
    userId: session.userId,
    tenantId: session.tenantId
  });

  const rows: Array<{ portfolio: Portfolio; valueUsd: number }> = [];
  for (const p of portfolios) {
    const id = p._id?.toHexString();
    if (!id) {
      continue;
    }
    let valueUsd = 0;
    try {
      valueUsd = await getPortfolioTotalBookUsdForSessionUser({
        userId: session.userId,
        tenantId: session.tenantId,
        portfolioId: id
      });
    } catch {
      valueUsd = 0;
    }
    rows.push({ portfolio: p, valueUsd });
  }

  const accountSlices: WorkspaceDashboardAccountSlice[] = await listWorkspaceDashboardAccountSlices({
    userId: session.userId,
    tenantId: session.tenantId
  });

  const initialRows: WorkspacePortfolioRow[] = rows.map(({ portfolio: p, valueUsd }) => {
    const id = p._id?.toHexString() ?? "";
    const portfolioKind: WorkspacePortfolioRow["portfolioKind"] =
      p.portfolioKind === "real_estate"
        ? "real_estate"
        : p.portfolioKind === "investments"
          ? "investments"
          : null;
    return {
      id,
      name: p.name || "Portfolio",
      isDefault: !!p.isDefault,
      portfolioKind,
      valueUsd,
      kindLabel: portfolioKindChoiceLabel(p.portfolioKind ?? null)
    };
  });

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader
        current="account"
        feedbackPageLabel="My Portfolios (Dashboard)"
        session={session}
      />

      <div className="xchat-body portfolio-page-body">
        <AppUserCollapsibleRailLayout
          mainClassName="app-user-shell-with-rail--padded"
          rail={<AppUserAccountPublicRailForSession session={session} />}
        >
          <div className="billing-page">
            <header className="billing-hero xf-noise-overlay surface-card xf-widget section-card">
              <p className="billing-hero__eyebrow">Workspace</p>
              <h1 className="billing-hero__title">My Portfolios (Dashboard)</h1>
              <p className="billing-hero__copy">
                Book-style totals (cash + positions). Rename portfolios, set default, and review allocation by portfolio
                and account. Holdings and positions live under{" "}
                <span className="text-[var(--xf-text-100)]">Portfolio</span> in the product nav.
              </p>
            </header>

            <div className="mt-6 surface-card xf-widget section-card p-4 md:p-6">
              <WorkspacePortfoliosClient initialAccountSlices={accountSlices} initialRows={initialRows} />
              <p className="mt-4 text-xs text-[var(--xf-text-300)]">
                <span className="xf-disclaimer-emphasis">Not financial advice.</span> Values are book-style totals
                (cash + cost basis), not live market marks.
              </p>
            </div>
          </div>
        </AppUserCollapsibleRailLayout>
      </div>
    </div>
  );
}
