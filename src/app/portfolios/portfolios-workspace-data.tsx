import { cookies } from "next/headers";

import { GlobalFooter } from "@/app/ui/global-footer";
import {
    loadAppUserDefaultBook,
    portfolioRefs,
    resolveChosenPortfolioId
} from "@/lib/app-user-default-book";
import type { SessionUser } from "@/lib/auth";
import { getMongoConnectionLabel, shouldShowAppUserDbLabel } from "@/lib/env";
import { canonicalMongoObjectIdHex } from "@/lib/mongo-object-id-hex";
import { resolvePrimaryPlatformRoleForDisplay } from "@/lib/platform-role-display";
import { getPortfolioLiveMarketValueUsdForSessionUser } from "@/lib/portfolio-live-market-value";
import { getPortfolioTotalBookUsdForSessionUser } from "@/lib/portfolio-total-book-usd";
import {
    listWorkspaceDashboardAccountSlices,
    loadWorkspacePortfoliosStockPulse
} from "@/lib/workspace-dashboard-metrics";
import { WORKSPACE_PORTFOLIO_COOKIE_NAME } from "@/lib/workspace-portfolio-cookie";
import { getWorkspaceTenantHeaderContext } from "@/lib/workspace-tenant-header";
import {
    adminListPortfolioAlerts,
    ensureUserWatchlistForSessionUser,
    listPortfoliosForSessionUser
} from "@/modules/core-admin/repository";
import { portfolioKindChoiceLabel } from "@/modules/core-admin/types";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { getTenantRoutePolicyForSession } from "@/modules/platform/tenant-route-policy";
import { resolveXoptionsEntitlements } from "@/modules/xoptions/entitlements";

import { tryIbkrLinkedAccountsSnapshotForSession } from "@/lib/portfolio-ibkr-ssr";

import type { WorkspacePortfolioRow } from "./portfolios-dashboard-client";
import { PortfoliosWorkspaceClient } from "./portfolios-workspace-client";

type Props = {
  session: SessionUser;
  focusRaw: string;
};

export async function PortfoliosWorkspaceData({ session, focusRaw }: Props) {
  const portfolios = await listPortfoliosForSessionUser({
    userId: session.userId,
    tenantId: session.tenantId
  });

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(WORKSPACE_PORTFOLIO_COOKIE_NAME)?.value;
  const wsRefs = portfolioRefs(portfolios);
  const chosenPortfolioId = resolveChosenPortfolioId(wsRefs, fromCookie);

  const [
    bookRows,
    accountSlices,
    stockPulse,
    workspaceBook,
    watchlistDoc,
    alertsRows,
    ibkrSnap
  ] = await Promise.all([
    Promise.all(
      portfolios.map(async (p) => {
        const id = p._id?.toHexString();
        if (!id) {
          return { portfolio: p, bookValueUsd: 0, marketValueUsd: 0 };
        }
        try {
          const [bookValueUsd, marketValueUsd] = await Promise.all([
            getPortfolioTotalBookUsdForSessionUser({
              userId: session.userId,
              tenantId: session.tenantId,
              portfolioId: id
            }),
            getPortfolioLiveMarketValueUsdForSessionUser({
              userId: session.userId,
              tenantId: session.tenantId,
              portfolioId: id
            })
          ]);
          return { portfolio: p, bookValueUsd, marketValueUsd };
        } catch {
          return { portfolio: p, bookValueUsd: 0, marketValueUsd: 0 };
        }
      })
    ),
    listWorkspaceDashboardAccountSlices({
      userId: session.userId,
      tenantId: session.tenantId
    }),
    loadWorkspacePortfoliosStockPulse({
      userId: session.userId,
      tenantId: session.tenantId,
      maxQuoteSymbols: 72,
      winnersCount: 2,
      losersCount: 2
    }),
    loadAppUserDefaultBook(session, { portfolioRows: portfolios }),
    ensureUserWatchlistForSessionUser({
      userId: session.userId,
      tenantId: session.tenantId
    }),
    chosenPortfolioId ? adminListPortfolioAlerts(chosenPortfolioId) : Promise.resolve([]),
    tryIbkrLinkedAccountsSnapshotForSession(session)
  ]);

  const topBookMovers = stockPulse.movers;
  const booksDayMark = stockPulse.booksDayMark;

  const initialRows: WorkspacePortfolioRow[] = bookRows.map(({ portfolio: p, bookValueUsd, marketValueUsd }) => {
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
      bookValueUsd,
      marketValueUsd,
      kindLabel: portfolioKindChoiceLabel(p.portfolioKind ?? null)
    };
  });

  const ids = new Set(initialRows.map((r) => r.id));
  const focusCandidate = focusRaw ? canonicalMongoObjectIdHex(focusRaw.trim()) : "";
  const focusPortfolioId =
    focusCandidate && ids.has(focusCandidate)
      ? focusCandidate
      : initialRows.find((r) => r.isDefault)?.id ?? initialRows[0]?.id ?? null;

  const defaultPortfolioIdForImport =
    workspaceBook?.portfolioId ??
    initialRows.find((r) => r.isDefault)?.id ??
    initialRows[0]?.id ??
    null;

  /** Any owned book id for portfolio-scoped watchlist API paths; symbols are tenant.user-global. */
  const deskWatchlistPortfolioId = chosenPortfolioId ?? defaultPortfolioIdForImport;

  const totalMarketValueUsd = initialRows.reduce((s, r) => s + Math.max(0, r.marketValueUsd), 0);

  const mongoConnection = shouldShowAppUserDbLabel() ? getMongoConnectionLabel() : "";
  const admin = isGlobalAdmin(session.roles);

  const workspaceTenant = await getWorkspaceTenantHeaderContext(session.tenantId);

  const entitlements = await resolveXoptionsEntitlements({
    userId: session.userId,
    roles: session.roles
  });

  const watchlistPreviewSymbols = (watchlistDoc?.symbols ?? [])
    .map((s) => (typeof s.symbol === "string" ? s.symbol.trim().toUpperCase() : ""))
    .filter(Boolean)
    .slice(0, 14);

  const workspaceDeskHints = {
    watchlistSymbolCount: watchlistDoc?.symbols?.length ?? 0,
    watchlistPreviewSymbols,
    activeAlertsCount: alertsRows.filter((a) => a.status === "active").length,
    ibkrLinkedAccountCount: ibkrSnap?.accountCount ?? null
  };

  const routePolicy = await getTenantRoutePolicyForSession(session);
  const visiblePathPrefixes = routePolicy.effectiveRolePolicy.allowedRoutes;

  return (
    <div className="xchat-shell flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[var(--xf-bg-900)]">
      <PortfoliosWorkspaceClient
        session={session}
        workspaceTenant={workspaceTenant}
        chosenPortfolioId={chosenPortfolioId}
        deskWatchlistPortfolioId={deskWatchlistPortfolioId}
        accountDetails={{
          email: session.email,
          username: session.username,
          displayName: session.displayName,
          xUserId: session.xUserId,
          avatarUrl: session.avatarUrl,
          mongoConnection,
          tenantIdHex: session.tenantId?.trim() || undefined,
          subscriptionPlan: entitlements.subscriptionPlan,
          isGlobalAdmin: admin,
          platformRole: resolvePrimaryPlatformRoleForDisplay(session.roles)
        }}
        accountFeedbackPageLabel="Portfolio desk"
        accountSlices={accountSlices}
        defaultPortfolioId={defaultPortfolioIdForImport}
        focusPortfolioId={focusPortfolioId}
        initialRows={initialRows}
        isGlobalAdmin={admin}
        booksDayMark={booksDayMark}
        topBookMovers={topBookMovers}
        totalMarketValueUsd={totalMarketValueUsd}
        workspaceBook={workspaceBook}
        workspaceDeskHints={workspaceDeskHints}
        visiblePathPrefixes={visiblePathPrefixes}
        workspaceFooter={<GlobalFooter />}
      />
    </div>
  );
}
