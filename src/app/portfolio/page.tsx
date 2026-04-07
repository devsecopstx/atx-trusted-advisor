import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PortfolioPageBody } from "@/app/portfolio/portfolio-page-body";
import { PortfolioPageBodySkeleton } from "@/app/portfolio/ui/portfolio-page-body-skeleton";
import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/portfolio");
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
