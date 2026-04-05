import { redirect } from "next/navigation";

import { GlobalFooter } from "@/app/ui/global-footer";
import { loadAppUserDefaultBook } from "@/lib/app-user-default-book";
import { getSessionUser } from "@/lib/auth";
import { getMongoConnectionLabel, shouldShowAppUserDbLabel } from "@/lib/env";
import { getPortfolioTotalBookUsdForSessionUser } from "@/lib/portfolio-total-book-usd";
import {
    listWorkspaceDashboardAccountSlices,
    listWorkspaceTopStockHoldingsForHero,
    type WorkspaceDashboardAccountSlice
} from "@/lib/workspace-dashboard-metrics";
import { listPortfoliosForSessionUser } from "@/modules/core-admin/repository";
import type { Portfolio } from "@/modules/core-admin/types";
import { portfolioKindChoiceLabel } from "@/modules/core-admin/types";
import { canUserLogin, isGlobalAdmin } from "@/modules/identity/authorization";

import type { WorkspacePortfolioRow } from "./portfolios-dashboard-client";
import { PortfoliosWorkspaceClient } from "./portfolios-workspace-client";

import "@/app/account/billing/billing-plans.css";
import "@/app/portfolio/portfolio.css";
import "@/app/xchat/xchat.css";
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

  const workspaceBook = await loadAppUserDefaultBook(session);
  const defaultPortfolioIdForImport =
    workspaceBook?.portfolioId ??
    initialRows.find((r) => r.isDefault)?.id ??
    initialRows[0]?.id ??
    null;

  const totalBookUsd = initialRows.reduce((s, r) => s + Math.max(0, r.valueUsd), 0);

  const mongoConnection = shouldShowAppUserDbLabel() ? getMongoConnectionLabel() : "";
  const admin = isGlobalAdmin(session.roles);

  return (
    <div className="xchat-shell">
      <PortfoliosWorkspaceClient
        accountDetails={{
          email: session.email,
          username: session.username,
          displayName: session.displayName,
          xUserId: session.xUserId,
          avatarUrl: session.avatarUrl,
          mongoConnection,
          isGlobalAdmin: admin
        }}
        accountFeedbackPageLabel="Portfolio workspace"
        accountSlices={accountSlices}
        defaultPortfolioId={defaultPortfolioIdForImport}
        focusPortfolioId={focusPortfolioId}
        initialRows={initialRows}
        isGlobalAdmin={admin}
        topHoldings={topHoldings}
        totalBookUsd={totalBookUsd}
        workspaceBook={workspaceBook}
      />
      <GlobalFooter />
    </div>
  );
}
