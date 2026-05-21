import { redirect } from "next/navigation";

import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { GlobalFooter } from "@/app/ui/global-footer";
import { resolveRouteGuardForSessionPath } from "@/lib/app-user-route-guard";
import { getSessionUser } from "@/lib/auth";
import { normalizeMongoObjectIdParam } from "@/lib/mongo-object-id-hex";
import { getWorkspaceTenantHeaderContext } from "@/lib/workspace-tenant-header";
import { adminListBrokerCatalog, listPortfoliosForSessionUser } from "@/modules/core-admin/repository";
import { canUserLogin } from "@/modules/identity/authorization";

import {
    ImportActivityClient,
    type ImportActivityBrokerOption,
    type ImportActivityPortfolioOption
} from "./import-activity-client";
import { importActivityPageCopy } from "./import-activity-copy";

import "@/app/account/billing/billing-plans.css";
import "@/app/import-activity/import-activity.css";
import "@/app/portfolio/portfolio.css";
import "@/app/portfolios/portfolios-dashboard.css";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ portfolioId?: string | string[] }>;
};

export default async function ImportActivityPage({ searchParams }: PageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/xchat?next=/import-activity");
  }
  if (!canUserLogin(session.roles)) {
    redirect("/xchat");
  }
  const routeGuard = await resolveRouteGuardForSessionPath(session, "/import-activity");
  if (!routeGuard.allowed) {
    redirect(routeGuard.redirectPath);
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
  const brokerCatalog = await adminListBrokerCatalog();
  const brokers: ImportActivityBrokerOption[] = brokerCatalog.map((broker) => ({
    id: broker.type,
    name: broker.name,
    iconUrl: broker.iconUrl ?? ""
  }));

  const sp = searchParams ? await searchParams : {};
  const portfolioIdRaw = sp.portfolioId;
  const portfolioIdParam =
    typeof portfolioIdRaw === "string"
      ? portfolioIdRaw
      : Array.isArray(portfolioIdRaw)
        ? portfolioIdRaw[0]
        : undefined;
  const portfolioIdNormalized = portfolioIdParam ? normalizeMongoObjectIdParam(portfolioIdParam) : "";
  const initialPortfolioId =
    portfolioIdNormalized && portfolios.some((p) => p.id === portfolioIdNormalized)
      ? portfolioIdNormalized
      : undefined;
  const workspaceTenant = await getWorkspaceTenantHeaderContext(session.tenantId);
  const rail = await AppUserAccountPublicRailForSession({
    session,
    feedbackPageLabel: "Import activities",
    railVariant: "workspace-product"
  });

  return (
    <div className="xchat-shell flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[var(--xf-bg-900)]">
      <div className="workspace-product-sticky-top sticky top-0 z-50 flex shrink-0 flex-col bg-[var(--xf-bg-800)]">
        <div className="workspace-product-approved-header-slot">
          <AppUserApprovedHeader
            current="portfolio"
            feedbackPageLabel="Import activities"
            session={session}
            workspaceTenant={workspaceTenant}
          />
        </div>
      </div>

      <div className="xchat-body flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-4 min-w-0 md:px-8 md:py-6">
        <AppUserCollapsibleRailLayout
          mainClassName="app-user-shell-with-rail--padded min-h-0 flex-1 overflow-y-auto overscroll-contain min-w-0 w-full max-w-full"
          mainFooter={<GlobalFooter />}
          rail={rail}
          railChrome="workspace-product"
          workspaceProductShellClassName="min-h-0 flex-1 overflow-hidden"
        >
          <div className="billing-page import-activity-page w-full min-w-0">
            <header className="billing-hero surface-card xf-widget section-card mb-2 px-3 py-2.5 xf-noise-overlay md:mb-3 md:px-4 md:py-3 dark:ring-1 dark:ring-[color:color-mix(in_srgb,var(--xf-text-100)_14%,transparent)]">
              <p className="billing-hero__eyebrow">Workspace</p>
              <h1 className="billing-hero__title text-[clamp(1.15rem,3.5vw,1.35rem)]">
                {importActivityPageCopy.title}
              </h1>
              <p className="billing-hero__copy max-w-none text-[0.82rem] leading-snug">
                {importActivityPageCopy.introLead}
              </p>
              <p className="billing-hero__copy mt-2 max-w-none text-[0.82rem] leading-snug">
                {importActivityPageCopy.introBackground}
              </p>
              <p className="billing-hero__copy mt-2 max-w-none text-[0.78rem] leading-snug text-[var(--xf-text-300)]">
                {importActivityPageCopy.brokerRoadmapNote}
              </p>
            </header>

            <div className="surface-card xf-widget section-card import-activity__main-surface p-2.5 md:p-3.5 dark:ring-1 dark:ring-[color:color-mix(in_srgb,var(--xf-text-100)_12%,transparent)]">
              <ImportActivityClient
                brokers={brokers}
                key={initialPortfolioId ?? "default"}
                initialPortfolioId={initialPortfolioId}
                portfolios={portfolios}
              />
            </div>
          </div>
        </AppUserCollapsibleRailLayout>
      </div>
    </div>
  );
}
