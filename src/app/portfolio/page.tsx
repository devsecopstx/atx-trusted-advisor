import { Suspense } from "react";

import { PortfolioPageBody } from "@/app/portfolio/portfolio-page-body";
import { PortfolioPageBodySkeleton } from "@/app/portfolio/ui/portfolio-page-body-skeleton";
import { PortfolioWorkspaceProductShell } from "@/app/portfolio/ui/portfolio-workspace-product-shell";
import { GlobalFooter } from "@/app/ui/global-footer";
import { ProductGuestShell } from "@/app/ui/product-guest-shell";
import { resolveRouteGuardForSessionPath } from "@/lib/app-user-route-guard";
import { getSessionUser } from "@/lib/auth";
import { getWorkspaceProductSidebarPropsForSession } from "@/lib/workspace-product-sidebar-server-props";
import { getWorkspaceTenantHeaderContext } from "@/lib/workspace-tenant-header";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ error?: string; details?: string }>;
};

export default async function PortfolioPage({ searchParams }: PageProps) {
  const session = await getSessionUser();
  const sp = searchParams ? await searchParams : {};
  const authError = typeof sp.error === "string" ? sp.error : undefined;
  const authDetails = typeof sp.details === "string" ? sp.details : undefined;

  if (!session) {
    return (
      <>
        <ProductGuestShell
          authDetails={authDetails}
          authError={authError}
          blurb={
            <p className="text-sm leading-relaxed text-[var(--xf-text-300)]">
              Sign in to view your portfolio desk, holdings, accounts, and desk tools at this URL — no redirect to
              xChat.
            </p>
          }
          nextPath="/portfolio"
          session={null}
        />
        <GlobalFooter />
      </>
    );
  }

  const routeGuard = await resolveRouteGuardForSessionPath(session, "/portfolio");
  if (!routeGuard.allowed) {
    redirect(routeGuard.redirectPath);
  }

  const [workspaceRailProps, workspaceTenant] = await Promise.all([
    getWorkspaceProductSidebarPropsForSession(session, "Portfolio"),
    getWorkspaceTenantHeaderContext(session.tenantId)
  ]);

  return (
    <PortfolioWorkspaceProductShell
      feedbackPageLabel="Portfolio"
      session={session}
      workspaceRailProps={workspaceRailProps}
      workspaceTenant={workspaceTenant}
    >
      <Suspense fallback={<PortfolioPageBodySkeleton />}>
        <PortfolioPageBody session={session} />
      </Suspense>
    </PortfolioWorkspaceProductShell>
  );
}
