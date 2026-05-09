import { GlobalFooter } from "@/app/ui/global-footer";
import { ProductGuestShell } from "@/app/ui/product-guest-shell";
import { WheelIdeaGenerator } from "@/components/xoptions/wheel-idea-generator";
import { resolveRouteGuardForSessionPath } from "@/lib/app-user-route-guard";
import { getSessionUser } from "@/lib/auth";
import { getWorkspaceTenantHeaderContext } from "@/lib/workspace-tenant-header";
import { canUserLogin } from "@/modules/identity/authorization";
import { redirect } from "next/navigation";

import { XoptionsWorkspaceProductShell } from "../ui/xoptions-workspace-product-shell";

export const dynamic = "force-dynamic";

export default async function XoptionsWheelPage() {
  const session = await getSessionUser();
  if (!session || !canUserLogin(session.roles)) {
    return (
      <>
        <ProductGuestShell
          blurb={
            <p className="text-sm leading-relaxed text-[var(--xf-text-300)]">
              Sign in to use xWheel Studio: generate wheel ideas, compare variants, and export an HNWI-ready report.
            </p>
          }
          nextPath="/xoptions/wheel"
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

  return (
    <XoptionsWorkspaceProductShell
      feedbackPageLabel="xWheel Studio"
      session={session}
      workspaceTenant={workspaceTenant}
    >
      <WheelIdeaGenerator />
    </XoptionsWorkspaceProductShell>
  );
}
