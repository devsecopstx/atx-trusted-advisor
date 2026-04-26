import { Suspense } from "react";

import { GlobalFooter } from "@/app/ui/global-footer";
import { ProductGuestShell } from "@/app/ui/product-guest-shell";
import { resolveRouteGuardForSessionPath } from "@/lib/app-user-route-guard";
import { getSessionUser } from "@/lib/auth";
import { canUserLogin } from "@/modules/identity/authorization";
import { redirect } from "next/navigation";

import { PortfoliosWorkspaceData } from "./portfolios-workspace-data";
import { PortfoliosWorkspaceSkeleton } from "./portfolios-workspace-skeleton";

import "@/app/account/billing/billing-plans.css";
import "@/app/portfolio/portfolio.css";
import "@/app/xchat/xchat.css";
import "./portfolios-dashboard.css";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    focus?: string | string[];
    error?: string | string[];
    details?: string | string[];
  }>;
};

function singleParam(v: string | string[] | undefined): string | undefined {
  if (v === undefined) {
    return undefined;
  }
  return Array.isArray(v) ? v[0] : v;
}

export default async function PortfoliosPage({ searchParams }: PageProps) {
  const session = await getSessionUser();
  const sp = searchParams ? await searchParams : {};
  const authError = singleParam(sp.error)?.trim();
  const authDetails = singleParam(sp.details)?.trim();

  if (!session || !canUserLogin(session.roles)) {
    return (
      <ProductGuestShell
        authDetails={authDetails}
        authError={authError}
        blurb={
          <p className="text-sm leading-relaxed text-[var(--xf-text-300)]">
            Sign in to open the Portfolios workspace (books, allocation, and desk shortcuts) at this URL — same sign-in
            flow as xChat, without leaving /portfolios.
          </p>
        }
        nextPath="/portfolios"
        session={session}
      />
    );
  }

  const routeGuard = await resolveRouteGuardForSessionPath(session, "/portfolios");
  if (!routeGuard.allowed) {
    redirect(routeGuard.redirectPath);
  }

  const focusRaw = singleParam(sp.focus)?.trim() ?? "";

  return (
    <>
      <Suspense fallback={<PortfoliosWorkspaceSkeleton />}>
        <PortfoliosWorkspaceData focusRaw={focusRaw} session={session} />
      </Suspense>
      <GlobalFooter />
    </>
  );
}
