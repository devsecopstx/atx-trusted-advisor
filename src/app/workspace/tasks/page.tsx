import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { UserTasksClient } from "@/app/account/tasks/user-tasks-client";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { GlobalFooter } from "@/app/ui/global-footer";
import { ProductGuestShell } from "@/app/ui/product-guest-shell";
import { WorkspaceProductSidebar } from "@/app/ui/workspace-product-sidebar";
import { TenantAutomationsClient } from "@/app/workspace/tasks/tenant-automations-client";
import { resolveRouteGuardForSessionPath } from "@/lib/app-user-route-guard";
import { getSessionUser } from "@/lib/auth";
import { getWorkspaceProductSidebarPropsForSession } from "@/lib/workspace-product-sidebar-server-props";
import {
    canAccessTenantUserAutomations,
    canMutateTenantUserAutomations,
    canUserLogin
} from "@/modules/identity/authorization";

import "@/app/xchat/xchat.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Automations"
};

export default async function WorkspaceTenantAutomationsPage() {
  const session = await getSessionUser();

  if (!session || !canUserLogin(session.roles)) {
    return (
      <ProductGuestShell
        blurb={
          <p className="text-sm leading-relaxed text-[var(--xf-text-300)]">
            Sign in with an advisor or operator role to manage tenant automations.
          </p>
        }
        nextPath="/workspace/tasks"
        session={session}
      />
    );
  }

  if (!canAccessTenantUserAutomations(session.roles)) {
    redirect("/access-denied?route=/workspace/tasks&redirect=/xchat");
  }

  const routeGuard = await resolveRouteGuardForSessionPath(session, "/workspace/tasks");
  if (!routeGuard.allowed) {
    redirect(routeGuard.redirectPath);
  }

  const workspaceRailProps = await getWorkspaceProductSidebarPropsForSession(session, "Automations");
  const allowMutations = canMutateTenantUserAutomations(session.roles);

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current={null} feedbackPageLabel="Automations" session={session} />

      <div className="xchat-body portfolio-page-body flex min-h-0 flex-1 flex-col overflow-hidden">
        <AppUserCollapsibleRailLayout
          mainClassName="app-user-shell-with-rail--padded min-h-0 flex-1 overflow-y-auto overscroll-contain min-w-0 w-full max-w-full"
          rail={<WorkspaceProductSidebar {...workspaceRailProps} />}
          railChrome="workspace-product"
        >
          <div className="billing-page max-w-5xl space-y-8">
            <UserTasksClient mode="workspace" />
            <TenantAutomationsClient allowMutations={allowMutations} />
          </div>
        </AppUserCollapsibleRailLayout>
      </div>
      <GlobalFooter />
    </div>
  );
}
