import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

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
    <div className="core-shell">
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
            Broker holdings import
          </h1>
          <p className="status-text">
            Merrill / Fidelity holdings CSV for this portfolio. Same API as{" "}
            <code className="font-mono text-xs">POST /api/admin/import/broker</code>. For another portfolio, use{" "}
            <Link className="login-xoptions-link" href="/admin/onboarding">
              onboarding
            </Link>{" "}
            or open that portfolio&apos;s accounts and import from there.
          </p>
        </article>
        <BrokerHoldingsImportPanel lockedPortfolioId={portfolioId} />
      </section>
    </div>
  );
}
