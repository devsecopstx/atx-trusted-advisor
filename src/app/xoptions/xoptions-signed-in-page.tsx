import { loadAppUserDefaultBook } from "@/lib/app-user-default-book";
import { resolveRouteGuardForSessionPath } from "@/lib/app-user-route-guard";
import type { SessionUser } from "@/lib/auth";
import { getWorkspaceTenantHeaderContext } from "@/lib/workspace-tenant-header";
import { redirect } from "next/navigation";

import { XoptionsWorkspaceProductShell } from "./ui/xoptions-workspace-product-shell";
import { XoptionsStrategyBuilderMount } from "./xoptions-strategy-builder-mount";

type XoptionsSignedInPageProps = {
  session: SessionUser;
};

export default async function XoptionsSignedInPage({ session }: XoptionsSignedInPageProps) {
  const routeGuard = await resolveRouteGuardForSessionPath(session, "/xoptions");
  if (!routeGuard.allowed) {
    redirect(routeGuard.redirectPath);
  }

  const workspaceTenant = await getWorkspaceTenantHeaderContext(session.tenantId);
  const workspaceBook = await loadAppUserDefaultBook(session);

  return (
    <XoptionsWorkspaceProductShell
      feedbackPageLabel="xOptions"
      session={session}
      workspaceTenant={workspaceTenant}
    >
      <XoptionsStrategyBuilderMount workspaceBook={workspaceBook} />
    </XoptionsWorkspaceProductShell>
  );
}
