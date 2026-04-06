import { redirect } from "next/navigation";

import { AppUserAccountPublicRailForSession } from "@/app/ui/app-user-account-public-rail";
import { AppUserCollapsibleRailLayout } from "@/app/ui/app-user-collapsible-rail-layout";
import { AppUserApprovedHeader } from "@/app/ui/app_user-approved-header";
import { getSessionUser } from "@/lib/auth";
import { normalizeMongoObjectIdParam } from "@/lib/mongo-object-id-hex";
import { adminListBrokerCatalog, listPortfoliosForSessionUser } from "@/modules/core-admin/repository";
import { canUserLogin } from "@/modules/identity/authorization";

import {
    ImportActivityClient,
    type ImportActivityBrokerOption,
    type ImportActivityPortfolioOption
} from "./import-activity-client";

import "@/app/account/billing/billing-plans.css";
import "@/app/portfolio/portfolio.css";

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

  return (
    <div className="xchat-shell">
      <AppUserApprovedHeader current="portfolio" feedbackPageLabel="Import activities" session={session} />

      <div className="xchat-body portfolio-page-body">
        <AppUserCollapsibleRailLayout
          mainClassName="app-user-shell-with-rail--padded"
          rail={<AppUserAccountPublicRailForSession session={session} />}
        >
          <div className="billing-page w-full min-w-0">
            <header className="billing-hero surface-card xf-widget section-card mb-3 px-4 py-3 xf-noise-overlay md:px-5 md:py-4">
              <p className="billing-hero__eyebrow">Workspace</p>
              <h1 className="billing-hero__title text-[clamp(1.15rem,3.5vw,1.35rem)]">Import activities</h1>
              <p className="billing-hero__copy max-w-none text-[0.82rem] leading-snug">
                Upload a broker holdings CSV and map accounts. The import runs immediately as a background-style{" "}
                <code className="font-mono text-xs">sync-broker</code> task.
              </p>
            </header>

            <div className="surface-card xf-widget section-card p-3 md:p-4">
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
