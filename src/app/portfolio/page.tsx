import { Suspense } from "react";

import { PortfolioPageBody } from "@/app/portfolio/portfolio-page-body";
import { PortfolioPageBodySkeleton } from "@/app/portfolio/ui/portfolio-page-body-skeleton";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { ProductGuestShell } from "@/app/ui/product-guest-shell";
import { WorkspaceProductSidebar } from "@/app/ui/workspace-product-sidebar";
import { getSessionUser } from "@/lib/auth";
import { getWorkspaceProductSidebarPropsForSession } from "@/lib/workspace-product-sidebar-server-props";
import { getWorkspaceTenantHeaderContext } from "@/lib/workspace-tenant-header";

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
    );
  }

  const [workspaceRailProps, workspaceTenant] = await Promise.all([
    getWorkspaceProductSidebarPropsForSession(session, "Portfolio"),
    getWorkspaceTenantHeaderContext(session.tenantId)
  ]);

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader
        current="portfolio"
        feedbackPageLabel="Portfolio"
        session={session}
        workspaceTenant={workspaceTenant}
      />

      <div className="xchat-body portfolio-page-body">
        <AppUserCollapsibleRailLayout
          mainClassName="app-user-shell-with-rail--padded"
          rail={<WorkspaceProductSidebar {...workspaceRailProps} />}
          railChrome="workspace-product"
        >
          <Suspense fallback={<PortfolioPageBodySkeleton />}>
            <PortfolioPageBody session={session} />
          </Suspense>
        </AppUserCollapsibleRailLayout>
      </div>
    </div>
  );
}
