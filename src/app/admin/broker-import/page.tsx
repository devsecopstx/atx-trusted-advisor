import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { isGlobalAdmin } from "@/modules/identity/authorization";

import { BrokerHoldingsImportPanel } from "../portfolios/ui/broker-holdings-import-panel";

type PageProps = {
  searchParams: Promise<{ portfolioId?: string }>;
};

export default async function AdminBrokerImportHubPage({ searchParams }: PageProps) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login?next=/admin/broker-import");
  }
  if (!isGlobalAdmin(session.roles)) {
    redirect("/admin?error=forbidden");
  }

  const { portfolioId: portfolioIdRaw } = await searchParams;
  const portfolioId = portfolioIdRaw?.trim() ?? "";
  const lockedId = portfolioId.length > 0 ? portfolioId : undefined;

  return (
    <div className="core-shell">
      <section className="panel stack-gap">
        <div className="tool-row" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <Link className="cta cta-secondary" href="/admin">
            ← Admin hub
          </Link>
          <Link className="cta cta-secondary" href="/admin/accounts">
            Accounts
          </Link>
          <Link className="cta cta-secondary" href="/admin/portfolios">
            Portfolios
          </Link>
          {lockedId ? (
            <Link className="cta cta-secondary" href={`/admin/accounts/${encodeURIComponent(lockedId)}`}>
              ← This portfolio&apos;s accounts
            </Link>
          ) : null}
        </div>

        <section className="hero-card xf-noise-overlay">
          <p className="eyebrow">atxfinance core admin</p>
          <h1 className="hero-title">Broker holdings import</h1>
          <p className="hero-copy">
            Map Merrill or Fidelity <strong>holdings</strong> CSV exports to core accounts. Uses{" "}
            <code className="font-mono text-xs">POST /api/admin/import/broker</code>. Create accounts under{" "}
            <Link className="login-xoptions-link" href="/admin/accounts">
              Accounts
            </Link>{" "}
            first.
            {lockedId ? (
              <>
                {" "}
                Portfolio is fixed from the URL; open{" "}
                <Link className="login-xoptions-link" href="/admin/broker-import">
                  /admin/broker-import
                </Link>{" "}
                without <code className="font-mono text-xs">portfolioId</code> to pick any book.
              </>
            ) : null}
          </p>
        </section>

        <BrokerHoldingsImportPanel lockedPortfolioId={lockedId} />
      </section>
    </div>
  );
}
