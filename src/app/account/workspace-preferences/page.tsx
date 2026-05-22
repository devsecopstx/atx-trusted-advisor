import { redirect } from "next/navigation";

import { WorkspacePreferencesClient } from "@/app/account/workspace-preferences/workspace-preferences-client";
import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { resolveRouteGuardForSessionPath } from "@/lib/app-user-route-guard";
import { getSessionUser } from "@/lib/auth";
import { canUserLogin, isAdvisorPlatformRole } from "@/modules/identity/authorization";

import "../billing/billing-plans.css";
import "../compliance/compliance.css";

export const dynamic = "force-dynamic";

export default async function AccountWorkspacePreferencesPage() {
  const session = await getSessionUser();
  if (!session || !canUserLogin(session.roles)) {
    redirect("/account/billing");
  }

  const routeGuard = await resolveRouteGuardForSessionPath(session, "/account/workspace-preferences");
  if (!routeGuard.allowed) {
    redirect(routeGuard.redirectPath);
  }

  const isAdvisor = isAdvisorPlatformRole(session.roles);
  const workspaceProductRail = await AppUserAccountPublicRailForSession({
    session,
    feedbackPageLabel: "Workspace preferences",
    railVariant: "workspace-product"
  });

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current={null} feedbackPageLabel="Workspace preferences" session={session} />
      <div className="xchat-body portfolio-page-body flex min-h-0 flex-1 flex-col overflow-hidden">
        <AppUserCollapsibleRailLayout
          mainClassName="app-user-shell-with-rail--padded min-h-0 flex-1 overflow-y-auto overscroll-contain min-w-0 w-full max-w-full"
          rail={workspaceProductRail}
          railChrome="workspace-product"
        >
          <div className="billing-page">
            <header className="billing-hero xf-noise-overlay surface-card xf-widget section-card">
              <p className="billing-hero__eyebrow">Profile</p>
              <h1 className="billing-hero__title">Workspace preferences</h1>
              <p className="billing-hero__copy">
                Appearance for all workspace users
                {isAdvisor
                  ? "; advisor-role FINRA registrations and AI disclosure acknowledgments unlock advice-like product paths."
                  : "."}
              </p>
            </header>
            <WorkspacePreferencesClient isAdvisorRole={isAdvisor} />
          </div>
        </AppUserCollapsibleRailLayout>
      </div>
    </div>
  );
}
