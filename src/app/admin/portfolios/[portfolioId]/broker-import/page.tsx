import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { ADMIN_BROKER_IMPORT_DESCRIPTION } from "@/app/admin/lib/broker-import-description";

import { BrokerHoldingsImportPanel } from "../../ui/broker-holdings-import-panel";

type PageProps = {
  params: Promise<{ portfolioId: string }>;
};

export default async function AdminPortfolioBrokerImportPage({ params }: PageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }
  const { portfolioId } = await params;
  return (
    <section className="panel stack-gap">
      <div className="tool-row">
        <Link className="cta cta-secondary" href={`/admin/portfolios/${encodeURIComponent(portfolioId)}/accounts`}>
          ← Accounts
        </Link>
        <Link className="cta cta-secondary" href="/admin/portfolios">
          Portfolios
        </Link>
      </div>
      <article className="surface-card xf-widget section-card">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title" style={{ fontSize: "1.35rem" }}>
          Broker import
        </h1>
        <p className="status-text">{ADMIN_BROKER_IMPORT_DESCRIPTION}</p>
        <p className="status-text" style={{ marginTop: "0.5rem" }}>
          This route locks the book to this portfolio. For another book, use{" "}
          <Link className="login-xoptions-link" href="/admin/onboarding">
            Broker import (hub)
          </Link>{" "}
          or <strong>Manage accounts → Broker import</strong> from{" "}
          <Link className="login-xoptions-link" href="/admin/portfolios">
            Portfolios
          </Link>
          .
        </p>
      </article>
      <BrokerHoldingsImportPanel lockedPortfolioId={portfolioId} />
    </section>
  );
}
