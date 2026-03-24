import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { ADMIN_BROKER_IMPORT_DESCRIPTION } from "../lib/broker-import-description";
import { BrokerHoldingsImportPanel } from "../portfolios/ui/broker-holdings-import-panel";

type PageProps = {
  searchParams: Promise<{ portfolioId?: string }>;
};

export default async function AdminBrokerImportPage({ searchParams }: PageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/admin/broker-import");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }
  const { portfolioId: portfolioIdRaw } = await searchParams;
  const portfolioId = portfolioIdRaw?.trim() ?? "";

  return (
    <div className="core-shell">
      <section className="panel stack-gap">
        <div className="tool-row" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <Link className="cta cta-secondary" href="/admin/accounts">
            Accounts
          </Link>
          <Link className="cta cta-secondary" href="/admin/portfolios">
            Portfolios
          </Link>
          <Link className="cta cta-secondary" href="/admin/onboarding">
            Onboarding
          </Link>
        </div>
        <article className="surface-card xf-widget section-card">
          <p className="eyebrow">atxfinance core admin</p>
          <h1 className="hero-title" style={{ fontSize: "1.35rem" }}>
            Broker import
          </h1>
          <p className="status-text">{ADMIN_BROKER_IMPORT_DESCRIPTION}</p>
        </article>
        <BrokerHoldingsImportPanel lockedPortfolioId={portfolioId || undefined} />
      </section>
    </div>
  );
}
