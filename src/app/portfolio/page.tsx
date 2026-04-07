import { Suspense } from "react";

import { PortfolioPageBody } from "@/app/portfolio/portfolio-page-body";
import { PortfolioPageBodySkeleton } from "@/app/portfolio/ui/portfolio-page-body-skeleton";
import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { ProductGuestShell } from "@/app/ui/product-guest-shell";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ error?: string; details?: string }>;
};

export default async function PortfolioPage({ searchParams }: PageProps) {
  const session = await getSessionUser();
  const sp = searchParams ? await searchParams : {};
  const authError = typeof sp.error === "string" ? sp.error : undefined;
  const authDetails = typeof sp.details === "string" ? sp.details : undefined;

  if (!session) {
    return (
      <ProductGuestShell
        authDetails={authDetails}
        authError={authError}
        blurb={
          <p className="text-sm leading-relaxed text-[var(--xf-text-300)]">
            Sign in to view your portfolio desk, holdings, accounts, and desk tools at this URL — no redirect to
            xChat.
          </p>
        }
        nextPath="/portfolio"
        session={null}
      />
    );
  }

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="portfolio" feedbackPageLabel="Portfolio" session={session} />

      <div className="xchat-body portfolio-page-body">
        <AppUserCollapsibleRailLayout rail={<AppUserAccountPublicRailForSession session={session} />}>
          <Suspense fallback={<PortfolioPageBodySkeleton />}>
            <PortfolioPageBody session={session} />
          </Suspense>
        </AppUserCollapsibleRailLayout>
      </div>
    </div>
  );
}
