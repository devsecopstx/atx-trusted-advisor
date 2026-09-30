import { Suspense } from "react";

import { GlobalFooter } from "@/app/ui/global-footer";
import { ProductGuestShell } from "@/app/ui/product-guest-shell";
import { XoptionsWeeklyReviewWorkspace } from "@/app/xoptions/ui/xoptions-weekly-review-workspace";
import { XoptionsWorkspaceProductShell } from "@/app/xoptions/ui/xoptions-workspace-product-shell";
import { loadAppUserDefaultBook } from "@/lib/app-user-default-book";
import { resolveRouteGuardForSessionPath } from "@/lib/app-user-route-guard";
import { getSessionUser } from "@/lib/auth";
import { getWorkspaceTenantHeaderContext } from "@/lib/workspace-tenant-header";
import { canUserLogin } from "@/modules/identity/authorization";
import { redirect } from "next/navigation";

import "@/app/account/billing/billing-plans.css";
import "@/app/portfolio/portfolio.css";
import "@/app/xchat/xchat.css";
import "@/app/portfolios/portfolios-dashboard.css";

export const dynamic = "force-dynamic";

export default async function XoptionsWeeklyReviewPage() {
  const session = await getSessionUser();
  if (!session || !canUserLogin(session.roles)) {
    return (
      <>
        <ProductGuestShell
          blurb={
            <p className="text-sm leading-relaxed text-[var(--xf-text-300)]">
              Sign in to open your weekly options desk — Hot Picks for the next 7–21 DTE wired to your
              workspace book.
            </p>
          }
          nextPath="/xoptions/weekly-review"
          session={session}
        />
        <GlobalFooter />
      </>
    );
  }

  const routeGuard = await resolveRouteGuardForSessionPath(session, "/xoptions");
  if (!routeGuard.allowed) {
    redirect(routeGuard.redirectPath);
  }

  const workspaceTenant = await getWorkspaceTenantHeaderContext(session.tenantId);
  const workspaceBook = await loadAppUserDefaultBook(session);
  const portfolioId = workspaceBook?.portfolioId ?? null;
  const defaultPortfolioId =
    workspaceBook?.workspacePortfolios.find((p) => p.isDefault)?.id ??
    workspaceBook?.workspacePortfolios[0]?.id ??
    portfolioId;

  return (
    <XoptionsWorkspaceProductShell
      feedbackPageLabel="Weekly review"
      session={session}
      workspaceTenant={workspaceTenant}
    >
      <Suspense
        fallback={
          <div className="mx-auto max-w-5xl px-3 py-4 text-sm text-[var(--xf-text-400)] sm:px-4">
            Loading weekly desk…
          </div>
        }
      >
        <XoptionsWeeklyReviewWorkspace
          accountName={workspaceBook?.accountName ?? null}
          defaultPortfolioId={defaultPortfolioId}
          portfolioId={portfolioId}
          portfolioName={workspaceBook?.portfolioName ?? null}
        />
      </Suspense>
    </XoptionsWorkspaceProductShell>
  );
}
