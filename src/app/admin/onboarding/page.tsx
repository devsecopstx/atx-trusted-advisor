import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { ADMIN_BROKER_IMPORT_DESCRIPTION } from "../lib/broker-import-description";
import { BrokerHoldingsImportPanel } from "../portfolios/ui/broker-holdings-import-panel";

type PageProps = {
  searchParams: Promise<{ portfolioId?: string }>;
};

export default async function AdminOnboardingPage({ searchParams }: PageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/admin/onboarding");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }

  const sp = await searchParams;
  const lockedPortfolioId = typeof sp.portfolioId === "string" ? sp.portfolioId.trim() : undefined;

  return (
    <div className="core-shell">
      <section className="hero-card xf-noise-overlay">
        <p className="eyebrow">atxfinance core admin</p>
        <h1 className="hero-title">Broker import</h1>
        <p className="hero-copy">{ADMIN_BROKER_IMPORT_DESCRIPTION}</p>
        <p className="hero-copy" style={{ marginTop: "0.75rem" }}>
          Ensure portfolios and accounts exist under{" "}
          <Link className="login-xoptions-link" href="/admin/portfolios">
            Portfolios
          </Link>{" "}
          before importing.
        </p>
      </section>

      <BrokerHoldingsImportPanel lockedPortfolioId={lockedPortfolioId || undefined} />
    </div>
  );
}
