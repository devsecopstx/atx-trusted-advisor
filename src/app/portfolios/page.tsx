import Link from "next/link";
import { redirect } from "next/navigation";

import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { getSessionUser } from "@/lib/auth";
import { getPortfolioTotalBookUsdForSessionUser } from "@/lib/portfolio-total-book-usd";
import {
    listWorkspaceDashboardAccountSlices,
    listWorkspaceTopStockHoldingsForHero,
    type WorkspaceDashboardAccountSlice
} from "@/lib/workspace-dashboard-metrics";
import { listPortfoliosForSessionUser } from "@/modules/core-admin/repository";
import type { Portfolio } from "@/modules/core-admin/types";
import { portfolioKindChoiceLabel } from "@/modules/core-admin/types";
import { canUserLogin } from "@/modules/identity/authorization";
import { resolveUsMarketDayContext } from "@/modules/scanner/tenant-market-calendar";

import { PortfoliosDashboardClient, type WorkspacePortfolioRow } from "./portfolios-dashboard-client";
import { PortfoliosHeroCharts } from "./portfolios-hero-charts";
import { PortfoliosHeroLeftColumn } from "./portfolios-hero-left-column";

import "@/app/account/billing/billing-plans.css";
import "@/app/portfolio/portfolio.css";
import "./portfolios-dashboard.css";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ focus?: string | string[] }>;
};

function singleParam(v: string | string[] | undefined): string | undefined {
  if (v === undefined) {
    return undefined;
  }
  return Array.isArray(v) ? v[0] : v;
}

export default async function PortfoliosPage({ searchParams }: PageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/xchat?next=/portfolios");
  }
  if (!canUserLogin(session.roles)) {
    redirect("/xchat");
  }

  const sp = searchParams ? await searchParams : {};
  const focusRaw = singleParam(sp.focus)?.trim() ?? "";

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

  const topHoldings = await listWorkspaceTopStockHoldingsForHero({
    userId: session.userId,
    tenantId: session.tenantId,
    limit: 5
  });

  const marketContext = resolveUsMarketDayContext(new Date());

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

  const ids = new Set(initialRows.map((r) => r.id));
  const focusPortfolioId =
    focusRaw && ids.has(focusRaw)
      ? focusRaw
      : initialRows.find((r) => r.isDefault)?.id ?? initialRows[0]?.id ?? null;

  const defaultPortfolioIdForImport =
    initialRows.find((r) => r.isDefault)?.id ?? initialRows[0]?.id ?? null;

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="portfolio" feedbackPageLabel="Your portfolios" session={session} />

      <div className="xchat-body portfolio-page-body">
        <AppUserCollapsibleRailLayout
          mainClassName="app-user-shell-with-rail--padded"
          rail={<AppUserAccountPublicRailForSession session={session} />}
        >
          <div className="billing-page">
            <div className="portfolios-hero-band grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] lg:gap-6 lg:items-stretch">
              <header className="billing-hero portfolios-hero-band__intro surface-card xf-widget section-card min-w-0 p-0">
                <div className="border-b border-white/10 px-3 py-2.5 md:px-4">
                  <p className="billing-hero__eyebrow">Your books</p>
                  <h1 className="billing-hero__title">Portfolios</h1>
                  <p className="billing-hero__copy">
                    Name and organize portfolios here. Accounts, cost basis, and CSV import tie to your{" "}
                    <Link className="text-[var(--xf-gain-green)] underline-offset-2 hover:underline" href="/portfolio">
                      Portfolio
                    </Link>{" "}
                    workspace.
                  </p>
                </div>
                <div className="p-2 md:p-3">
                  <PortfoliosHeroLeftColumn
                    defaultPortfolioId={defaultPortfolioIdForImport}
                    marketContext={marketContext}
                    topHoldings={topHoldings}
                  />
                </div>
              </header>
              <div className="portfolios-hero-band__charts-col surface-card xf-widget section-card min-h-0 min-w-0 p-3 md:p-4">
                <PortfoliosHeroCharts initialAccountSlices={accountSlices} initialRows={initialRows} />
              </div>
            </div>

            <div className="mt-6 surface-card xf-widget section-card p-4 md:p-6">
              <PortfoliosDashboardClient focusPortfolioId={focusPortfolioId} initialRows={initialRows} />
              <p className="mt-4 text-xs text-[var(--xf-text-300)]">
                <span className="xf-disclaimer-emphasis">Not financial advice.</span> Values are book-style totals (cash +
                cost basis), not live market marks.
              </p>
            </div>
          </div>
        </AppUserCollapsibleRailLayout>
      </div>
    </div>
  );
}
