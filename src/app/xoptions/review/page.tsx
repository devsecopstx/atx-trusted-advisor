import { GlobalFooter } from "@/app/ui/global-footer";
import { ProductGuestShell } from "@/app/ui/product-guest-shell";
import { loadAppUserDefaultBook } from "@/lib/app-user-default-book";
import { resolveRouteGuardForSessionPath } from "@/lib/app-user-route-guard";
import { getSessionUser, readPendingXLinkCookie } from "@/lib/auth";
import { getWorkspaceTenantHeaderContext } from "@/lib/workspace-tenant-header";
import { canUserLogin } from "@/modules/identity/authorization";
import { redirect } from "next/navigation";

import { XoptionsWorkspaceProductShell } from "../ui/xoptions-workspace-product-shell";
import { XoptionsReviewRouteMount } from "./xoptions-review-route-mount";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    symbol?: string;
    contractId?: string;
    expiration?: string;
    strike?: string;
    side?: string;
    step?: string;
  }>;
};

export default async function XoptionsReviewPage({ searchParams }: PageProps) {
  const session = await getSessionUser();
  const sp = searchParams ? await searchParams : {};
  const pendingXHandle =
    sp.symbol == null ? (await readPendingXLinkCookie())?.username : undefined;

  if (!session || !canUserLogin(session.roles)) {
    return (
      <>
        <ProductGuestShell
          blurb={
            <p className="text-sm leading-relaxed text-[var(--xf-text-300)]">
              Sign in to review an xOptions order ticket with risk alerts, portfolio impact, and audit-ready export.
            </p>
          }
          nextPath="/xoptions/review"
          pendingXHandle={pendingXHandle}
          session={session}
        />
        <GlobalFooter />
      </>
    );
  }

  const routeGuard = await resolveRouteGuardForSessionPath(session, "/xoptions/review");
  if (!routeGuard.allowed) {
    redirect(routeGuard.redirectPath);
  }

  const workspaceTenant = await getWorkspaceTenantHeaderContext(session.tenantId);
  const workspaceBook = await loadAppUserDefaultBook(session);

  return (
    <XoptionsWorkspaceProductShell
      feedbackPageLabel="xOptions review"
      session={session}
      workspaceTenant={workspaceTenant}
    >
      <XoptionsReviewRouteMount
        contractId={typeof sp.contractId === "string" ? sp.contractId : null}
        expiration={typeof sp.expiration === "string" ? sp.expiration : null}
        side={sp.side === "call" || sp.side === "put" ? sp.side : null}
        strike={typeof sp.strike === "string" ? Number.parseFloat(sp.strike) : null}
        symbol={typeof sp.symbol === "string" ? sp.symbol : null}
        workspaceBook={workspaceBook}
      />
    </XoptionsWorkspaceProductShell>
  );
}
