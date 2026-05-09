import { GlobalFooter } from "@/app/ui/global-footer";
import { ProductGuestShell } from "@/app/ui/product-guest-shell";
import { resolveRouteGuardForSessionPath } from "@/lib/app-user-route-guard";
import { getSessionUser, readPendingXLinkCookie } from "@/lib/auth";
import { getWorkspaceTenantHeaderContext } from "@/lib/workspace-tenant-header";
import { canUserLogin } from "@/modules/identity/authorization";
import { redirect } from "next/navigation";

import { XoptionsWorkspaceProductShell } from "./ui/xoptions-workspace-product-shell";
import { XoptionsStrategyBuilderMount } from "./xoptions-strategy-builder-mount";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ error?: string; details?: string }>;
};

export default async function XoptionsPage({ searchParams }: PageProps) {
  const session = await getSessionUser();
  const sp = searchParams ? await searchParams : {};
  const authError = typeof sp.error === "string" ? sp.error : undefined;
  const authDetails = typeof sp.details === "string" ? sp.details : undefined;
  const pendingXHandle =
    authError === "email_link_required" ? (await readPendingXLinkCookie())?.username : undefined;

  if (!session || !canUserLogin(session.roles)) {
    return (
      <>
        <ProductGuestShell
          authDetails={authDetails}
          authError={authError}
          blurb={
            <p className="text-sm leading-relaxed text-[var(--xf-text-300)]">
              Sign in to open the xOptions strategy builder: pick a symbol, horizon, and{" "}
              <strong className="text-[var(--xf-text-200)]">Choose contract</strong> for covered calls, cash-secured
              puts, and other single-leg strategies — without leaving this URL.
            </p>
          }
          nextPath="/xoptions"
          pendingXHandle={pendingXHandle}
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
      feedbackPageLabel="xOptions"
      session={session}
      workspaceTenant={workspaceTenant}
    >
      <XoptionsStrategyBuilderMount />
    </XoptionsWorkspaceProductShell>
  );
}
