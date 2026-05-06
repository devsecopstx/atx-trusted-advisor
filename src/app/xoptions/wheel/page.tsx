import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { ProductGuestShell } from "@/app/ui/product-guest-shell";
import { WheelIdeaGenerator } from "@/components/xoptions/wheel-idea-generator";
import { resolveRouteGuardForSessionPath } from "@/lib/app-user-route-guard";
import { getSessionUser } from "@/lib/auth";
import { getWorkspaceTenantHeaderContext } from "@/lib/workspace-tenant-header";
import { canUserLogin } from "@/modules/identity/authorization";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function XoptionsWheelPage() {
  const session = await getSessionUser();
  if (!session || !canUserLogin(session.roles)) {
    return (
      <ProductGuestShell
        blurb={
          <p className="text-sm leading-relaxed text-[var(--xf-text-300)]">
            Sign in to use xWheel Studio: generate wheel ideas, compare variants, and export an HNWI-ready report.
          </p>
        }
        nextPath="/xoptions/wheel"
        session={session}
      />
    );
  }

  const routeGuard = await resolveRouteGuardForSessionPath(session, "/xoptions");
  if (!routeGuard.allowed) {
    redirect(routeGuard.redirectPath);
  }
  const workspaceTenant = await getWorkspaceTenantHeaderContext(session.tenantId);

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader
        current="xoptions"
        feedbackPageLabel="xWheel Studio"
        session={session}
        workspaceTenant={workspaceTenant}
      />
      <div className="xchat-body min-w-0 px-3 py-4 md:px-8 md:py-6">
        <AppUserCollapsibleRailLayout
          mainClassName="min-w-0 w-full max-w-full"
          rail={<AppUserAccountPublicRailForSession railVariant="workspace-product" session={session} />}
          railChrome="workspace-product"
        >
          <WheelIdeaGenerator />
        </AppUserCollapsibleRailLayout>
      </div>
    </div>
  );
}
