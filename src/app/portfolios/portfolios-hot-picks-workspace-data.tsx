import { cookies } from "next/headers";

import { GlobalFooter } from "@/app/ui/global-footer";
import {
    loadAppUserDefaultBook,
    portfolioRefs,
    resolveChosenPortfolioId
} from "@/lib/app-user-default-book";
import type { SessionUser } from "@/lib/auth";
import { getMongoConnectionLabel, shouldShowAppUserDbLabel } from "@/lib/env";
import { resolvePrimaryPlatformRoleForDisplay } from "@/lib/platform-role-display";
import { getPortfolioLiveMarketValueUsdForSessionUser } from "@/lib/portfolio-live-market-value";
import { loadWorkspacePortfoliosStockPulse } from "@/lib/workspace-dashboard-metrics";
import { WORKSPACE_PORTFOLIO_COOKIE_NAME } from "@/lib/workspace-portfolio-cookie";
import { getWorkspaceTenantHeaderContext } from "@/lib/workspace-tenant-header";
import { listPortfoliosForSessionUser } from "@/modules/core-admin/repository";
import { isGlobalAdmin } from "@/modules/identity/authorization";
import { getTenantRoutePolicyForSession } from "@/modules/platform/tenant-route-policy";
import { resolveXoptionsEntitlements } from "@/modules/xoptions/entitlements";

import { PortfoliosHotPicksWorkspaceClient } from "./portfolios-hot-picks-workspace-client";

type Props = {
  session: SessionUser;
};

export async function PortfoliosHotPicksWorkspaceData({ session }: Props) {
  const portfolios = await listPortfoliosForSessionUser({
    userId: session.userId,
    tenantId: session.tenantId
  });

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(WORKSPACE_PORTFOLIO_COOKIE_NAME)?.value;
  const wsRefs = portfolioRefs(portfolios);
  const chosenPortfolioId = resolveChosenPortfolioId(wsRefs, fromCookie);
  const defaultPortfolioId =
    portfolios.find((p) => p.isDefault)?._id?.toHexString() ??
    portfolios[0]?._id?.toHexString() ??
    null;

  const [stockPulse, workspaceBook, workspaceTenant, totalMarketValueUsd, entitlements] =
    await Promise.all([
      loadWorkspacePortfoliosStockPulse({
        userId: session.userId,
        tenantId: session.tenantId,
        maxQuoteSymbols: 24,
        winnersCount: 2,
        losersCount: 2
      }),
      loadAppUserDefaultBook(session, { portfolioRows: portfolios }),
      getWorkspaceTenantHeaderContext(session.tenantId),
      chosenPortfolioId
        ? getPortfolioLiveMarketValueUsdForSessionUser({
            userId: session.userId,
            tenantId: session.tenantId,
            portfolioId: chosenPortfolioId
          })
        : Promise.resolve(0),
      resolveXoptionsEntitlements({
        userId: session.userId,
        roles: session.roles
      })
    ]);

  const topBookMovers = stockPulse.movers;
  const booksDayMark = stockPulse.booksDayMark;
  const mongoConnection = shouldShowAppUserDbLabel() ? getMongoConnectionLabel() : "";
  const admin = isGlobalAdmin(session.roles);
  const routePolicy = await getTenantRoutePolicyForSession(session);
  const visiblePathPrefixes = routePolicy.effectiveRolePolicy.allowedRoutes;

  return (
    <div className="xchat-shell flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[var(--xf-bg-900)]">
      <PortfoliosHotPicksWorkspaceClient
        session={session}
        workspaceTenant={workspaceTenant}
        chosenPortfolioId={chosenPortfolioId}
        defaultPortfolioId={defaultPortfolioId}
        workspaceBook={workspaceBook}
        totalMarketValueUsd={totalMarketValueUsd}
        booksDayMark={booksDayMark}
        topBookMovers={topBookMovers}
        isGlobalAdmin={admin}
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
        visiblePathPrefixes={visiblePathPrefixes}
        workspaceFooter={<GlobalFooter />}
      />
    </div>
  );
}
