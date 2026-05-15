import { GlobalFooter } from "@/app/ui/global-footer";
import { ProductGuestShell } from "@/app/ui/product-guest-shell";
import { QuantTraderPanel } from "@/app/xoptions/ui/quant-trader-panel";
import { XoptionsWorkspaceProductShell } from "@/app/xoptions/ui/xoptions-workspace-product-shell";
import { loadAppUserDefaultBook } from "@/lib/app-user-default-book";
import { resolveRouteGuardForSessionPath } from "@/lib/app-user-route-guard";
import { getSessionUser } from "@/lib/auth";
import { getWorkspaceTenantHeaderContext } from "@/lib/workspace-tenant-header";
import { canUserLogin } from "@/modules/identity/authorization";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function XoptionsQuantTraderPage() {
  const session = await getSessionUser();
  if (!session || !canUserLogin(session.roles)) {
    return (
      <>
        <ProductGuestShell
          blurb={
            <p className="text-sm leading-relaxed text-[var(--xf-text-300)]">
              Sign in to run Monte Carlo tail-risk simulations across your workspace portfolios with the Quant Trader
              desk.
            </p>
          }
          nextPath="/xoptions/quant-trader"
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

  return (
    <XoptionsWorkspaceProductShell
      feedbackPageLabel="Quant Trader"
      session={session}
      workspaceTenant={workspaceTenant}
    >
      <div className="xoptions-quant-trader-page mx-auto max-w-5xl px-3 py-4 sm:px-4">
        <header className="mb-4">
          <h1 className="text-lg font-bold tracking-tight text-[var(--xf-text-100)]">Quant Trader desk</h1>
          <p className="xoptions-hint mt-1 text-sm text-[var(--xf-text-400)]">
            Monte Carlo tail-risk across your workspace portfolios — scoped to{" "}
            <span className="font-semibold text-[var(--xf-text-200)]">
              {workspaceBook?.portfolioName ?? "workspace"}
            </span>{" "}
            and all owned books.
          </p>
        </header>
        <QuantTraderPanel />
      </div>
    </XoptionsWorkspaceProductShell>
  );
}
