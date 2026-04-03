import { redirect } from "next/navigation";

import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { getSessionUser } from "@/lib/auth";
import { listPortfoliosForSessionUser } from "@/modules/core-admin/repository";
import { canUserLogin } from "@/modules/identity/authorization";

import { ImportActivityClient, type ImportActivityPortfolioOption } from "./import-activity-client";

import "@/app/account/billing/billing-plans.css";
import "@/app/portfolio/portfolio.css";

export const dynamic = "force-dynamic";

export default async function ImportActivityPage() {
  const session = await getSessionUser();
  if (!session) {
    redirect("/xchat?next=/import-activity");
  }
  if (!canUserLogin(session.roles)) {
    redirect("/xchat");
  }

  const portfoliosRaw = await listPortfoliosForSessionUser({
    userId: session.userId,
    tenantId: session.tenantId
  });

  const portfolios: ImportActivityPortfolioOption[] = portfoliosRaw
    .map((p) => ({
      id: p._id?.toHexString() ?? "",
      name: p.name || "Portfolio"
    }))
    .filter((p) => p.id);

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="portfolio" feedbackPageLabel="Import activities" session={session} />

      <div className="xchat-body portfolio-page-body">
        <AppUserCollapsibleRailLayout
          mainClassName="app-user-shell-with-rail--padded"
          rail={<AppUserAccountPublicRailForSession session={session} />}
        >
          <div className="billing-page mx-auto w-full max-w-sm">
            <header className="billing-hero surface-card xf-widget section-card mb-3 px-4 py-3 xf-noise-overlay md:px-5 md:py-4">
              <p className="billing-hero__eyebrow">Workspace</p>
              <h1 className="billing-hero__title text-[clamp(1.15rem,3.5vw,1.35rem)]">Import activities</h1>
              <p className="billing-hero__copy max-w-none text-[0.82rem] leading-snug">
                Upload a broker holdings CSV and map accounts. The import runs immediately as a background-style{" "}
                <code className="font-mono text-xs">sync-broker</code> task.
              </p>
            </header>

            <div className="surface-card xf-widget section-card p-3 md:p-4">
              <ImportActivityClient portfolios={portfolios} />
            </div>
          </div>
        </AppUserCollapsibleRailLayout>
      </div>
    </div>
  );
}
