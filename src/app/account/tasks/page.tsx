import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { UserTasksClient } from "@/app/account/tasks/user-tasks-client";
import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { GlobalFooter } from "@/app/ui/global-footer";
import { ProductGuestShell } from "@/app/ui/product-guest-shell";
import { resolveRouteGuardForSessionPath } from "@/lib/app-user-route-guard";
import { getSessionUser } from "@/lib/auth";
import { canUserLogin } from "@/modules/identity/authorization";

import "@/app/account/billing/billing-plans.css";
import "@/app/xchat/xchat.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tasks"
};

type PageProps = {
  searchParams?: Promise<{ portfolioId?: string | string[] }>;
};

function singleParam(v: string | string[] | undefined): string | undefined {
  if (v === undefined) {
    return undefined;
  }
  return Array.isArray(v) ? v[0] : v;
}

export default async function AccountTasksPage({ searchParams }: PageProps) {
  const session = await getSessionUser();
  const sp = searchParams ? await searchParams : {};
  const portfolioIdRaw = singleParam(sp.portfolioId)?.trim();

  if (!session || !canUserLogin(session.roles)) {
    return (
      <ProductGuestShell
        blurb={
          <p className="text-sm leading-relaxed text-[var(--xf-text-300)]">
            Sign in to manage automated tasks (scheduled xChat prompts scoped to your workspace).
          </p>
        }
        nextPath="/account/tasks"
        session={session}
      />
    );
  }

  const routeGuard = await resolveRouteGuardForSessionPath(session, "/account/tasks");
  if (!routeGuard.allowed) {
    redirect(routeGuard.redirectPath);
  }

  const workspaceProductRail = await AppUserAccountPublicRailForSession({
    session,
    feedbackPageLabel: "Tasks",
    railVariant: "workspace-product"
  });

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current={null} feedbackPageLabel="Tasks" session={session} />

      <div className="xchat-body portfolio-page-body">
        <AppUserCollapsibleRailLayout
          mainClassName="app-user-shell-with-rail--padded"
          rail={workspaceProductRail}
          railChrome="workspace-product"
        >
          <div className="billing-page max-w-5xl">
            <UserTasksClient initialPortfolioId={portfolioIdRaw ?? null} />
          </div>
        </AppUserCollapsibleRailLayout>
      </div>
      <GlobalFooter />
    </div>
  );
}
